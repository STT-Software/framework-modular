import { FixedClock } from '../../platform/time/fixed-clock.spec';
import { TurnosBaseSetup, TURNOS_PROFILE_IDS, type TurnosProfileId, type TurnosProfileOption, type TurnosSetupStatus } from '../turnos/public';
import {
  AdministeredBusinessProfiles,
  type AdministeredBusinessProfile,
  type BusinessModuleId,
  type CategoryChange,
  type ContactChange,
} from '../businesses/public';
import type { BusinessSetup } from './domain/business-setup';
import { BusinessSetupRepository, type SetupPatch } from './domain/business-setup.repository';
import type { LogoFile } from './domain/logo';
import { BusinessSetupService } from './application/business-setup.service';
import { ModuleSetupStatusRegistry } from './application/module-setup-status.registry';
import type { WeekSchedule } from './domain/week-schedule';

export const BOSS_EMAIL = 'ana@cafecentral.co';
export const BUSINESS_ID = 'a'.repeat(24);
export const OTHER_BUSINESS_ID = 'b'.repeat(24);

export function aProfile(overrides: Partial<AdministeredBusinessProfile> = {}): AdministeredBusinessProfile {
  return {
    id: BUSINESS_ID,
    name: 'Café Central',
    legalName: 'Café Central S.A.S.',
    taxId: '900123456-7',
    phone: '+573001234567',
    address: 'Calle 10 # 5-20, Bogotá',
    supportEmail: 'hola@cafecentral.co',
    website: 'https://cafecentral.co',
    category: 'gastronomy',
    categoryOther: null,
    currency: 'COP',
    timezone: 'America/Bogota',
    modules: ['turnos', 'reservas'],
    status: 'active',
    ...overrides,
  };
}

/**
 * The businesses of the owner, as the businesses module's public contract would answer: only the current boss of an ACTIVE
 * business sees or changes it, and the contract cannot touch modules, boss, currency or time zone.
 */
export class FakeAdministeredBusinessProfiles extends AdministeredBusinessProfiles {
  readonly bosses = new Map<string, string>();
  readonly businesses = new Map<string, AdministeredBusinessProfile>();
  readonly bossOf = (id: string) => this.bosses.get(id);

  add(business: AdministeredBusinessProfile, bossEmail: string): void {
    this.businesses.set(business.id, business);
    this.bosses.set(business.id, bossEmail);
  }

  private visible(bossEmail: string, businessId: string): AdministeredBusinessProfile | null {
    const business = this.businesses.get(businessId);
    return business && business.status === 'active' && this.bosses.get(businessId) === bossEmail ? business : null;
  }

  async find(bossEmail: string, businessId: string) {
    const business = this.visible(bossEmail, businessId);
    return business ? { ...business } : null;
  }

  async updateContact(bossEmail: string, businessId: string, change: ContactChange) {
    const business = this.visible(bossEmail, businessId);
    if (!business) return null;
    Object.assign(business, change);
    return { ...business };
  }

  async updateCategory(bossEmail: string, businessId: string, change: CategoryChange) {
    const business = this.visible(bossEmail, businessId);
    if (!business) return null;
    business.category = change.category;
    business.categoryOther = change.category === 'other' ? change.categoryOther : null;
    return { ...business };
  }
}

/** In-memory setups with the same rules as the MongoDB repository (one per business, patches only touch what they name). */
export class InMemoryBusinessSetupRepository extends BusinessSetupRepository {
  readonly items = new Map<string, BusinessSetup>();
  readonly logos = new Map<string, LogoFile>();

  async find(businessId: string) {
    const item = this.items.get(businessId);
    return item ? structuredClone(item) : null;
  }

  async findLogo(businessId: string) {
    return this.logos.get(businessId) ?? null;
  }

  async apply(businessId: string, patch: SetupPatch, now: Date) {
    const item: BusinessSetup = this.items.get(businessId) ?? {
      businessId,
      description: null,
      logo: null,
      baseSchedule: null,
      moduleSchedules: {},
      currentStep: null,
      visitedSteps: [],
      baseReadyAt: null,
      createdAt: now,
      updatedAt: now,
    };
    if (patch.description !== undefined) item.description = patch.description;
    if (patch.logo === null) {
      item.logo = null;
      this.logos.delete(businessId);
    } else if (patch.logo) {
      item.logo = { ...patch.logo.info };
      this.logos.set(businessId, patch.logo);
    }
    if (patch.baseSchedule) item.baseSchedule = structuredClone(patch.baseSchedule);
    if (patch.moduleSchedule) item.moduleSchedules[patch.moduleSchedule.moduleId] = structuredClone(patch.moduleSchedule.entry);
    if (patch.step) {
      item.currentStep = patch.step;
      if (!item.visitedSteps.includes(patch.step)) item.visitedSteps.push(patch.step);
    }
    if (patch.baseReadyAt !== undefined) item.baseReadyAt = patch.baseReadyAt;
    item.updatedAt = now;
    this.items.set(businessId, item);
    return structuredClone(item);
  }
}

/** What Turnos tells the base setup: the profile chosen per business and how far its configuration is. In memory. */
export class FakeTurnosBaseSetup extends TurnosBaseSetup {
  readonly chosen = new Map<string, TurnosProfileId>();
  readonly statuses = new Map<string, TurnosSetupStatus>();
  constructor(private readonly profiles: FakeAdministeredBusinessProfiles) {
    super();
  }
  options(): readonly TurnosProfileOption[] {
    return TURNOS_PROFILE_IDS.map((id) => ({ id, name: id, description: '', suggestedQueues: [{ name: `Cola ${id}`, mode: 'auto' as const, averageMinutes: 10 }] }));
  }
  suggestedFor(category: string): TurnosProfileId {
    return category === 'gastronomy' ? 'restaurant' : 'custom';
  }
  async current(businessId: string, category: string) {
    return this.chosen.get(businessId) ?? this.suggestedFor(category);
  }
  async choose(adminEmail: string, businessId: string, profile: TurnosProfileId) {
    const business = await this.profiles.find(adminEmail, businessId);
    if (!business) throw new Error('not the boss of an active business');
    if (!business.modules.includes('turnos')) throw new Error('turnos not enabled');
    this.chosen.set(businessId, profile);
    return profile;
  }
  async statusOf(businessId: string) {
    return this.statuses.get(businessId) ?? { ready: false, queueCount: 0, operatorCount: 0 };
  }
}

/** A service with a business of Ana (modules turnos and reservas) and another one of Luis, all in memory. */
export function setupBusinessSetup() {
  const clock = new FixedClock('2026-03-04T15:00:00.000Z'); // Wednesday 10:00 in Bogotá (UTC-5)
  const profiles = new FakeAdministeredBusinessProfiles();
  const repository = new InMemoryBusinessSetupRepository();
  profiles.add(aProfile(), BOSS_EMAIL);
  profiles.add(aProfile({ id: OTHER_BUSINESS_ID, name: 'Librería Sur', modules: ['inventario'] }), 'luis@libreriasur.co');
  const turnos = new FakeTurnosBaseSetup(profiles);
  const statusRegistry = new ModuleSetupStatusRegistry();
  const service = new BusinessSetupService(profiles, repository, clock, turnos, statusRegistry);
  /** The same persisted data seen from a brand new service, as after signing out and coming back. */
  const reopen = () => new BusinessSetupService(profiles, repository, clock, turnos, statusRegistry);
  return { service, reopen, profiles, repository, clock, turnos, statusRegistry };
}

export const NIGHT_SHIFT: WeekSchedule['mon'] = { open: true, ranges: [{ start: '18:00', end: '23:00' }] };
export function aWeek(day: WeekSchedule['mon'] = { open: true, ranges: [{ start: '07:00', end: '16:00' }] }): WeekSchedule {
  const closed = { open: false, ranges: [] };
  return { mon: day, tue: day, wed: day, thu: day, fri: day, sat: closed, sun: closed };
}
export type { BusinessModuleId };
