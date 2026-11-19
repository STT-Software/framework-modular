import { FixedClock } from '../../platform/time/fixed-clock.spec';
import {
  AdministeredBusinessProfiles,
  BusinessDirectory,
  type AdministeredBusinessProfile,
  type BusinessAccessView,
  type CategoryChange,
  type ContactChange,
} from '../businesses/public';
import { TurnosConfigurationService } from './application/turnos-configuration.service';
import { TurnosConfigurationStore } from './application/turnos-configuration.store';
import { TurnosBaseSetupService } from './application/turnos-base-setup.service';
import { TurnosOperatorAccessSource } from './application/turnos-operator-access.source';
import { TurnosOperatorService } from './application/turnos-operator.service';
import type { TurnosConfiguration } from './domain/configuration';
import { TurnosConfigurationRepository } from './domain/turnos-configuration.repository';

export const BOSS = 'ana@cafecentral.co';
export const BUSINESS_ID = 'a'.repeat(24);
export const OTHER_BOSS = 'luis@libreriasur.co';
export const OTHER_BUSINESS_ID = 'b'.repeat(24);

export function aBusiness(overrides: Partial<BusinessAccessView> = {}): BusinessAccessView {
  return {
    id: BUSINESS_ID,
    ownerId: 'owner-1',
    name: 'Café Central',
    status: 'active',
    category: 'gastronomy',
    categoryOther: null,
    modules: ['turnos'],
    boss: { assignmentId: 'assignment-1', name: 'Ana Gómez', email: BOSS },
    ...overrides,
  };
}

/** The businesses of the owner, as the public contract of the businesses module answers. */
export class FakeBusinessDirectory extends BusinessDirectory {
  readonly businesses = new Map<string, BusinessAccessView>();
  set(business: BusinessAccessView) {
    this.businesses.set(business.id, business);
  }
  async find(id: string) {
    return this.businesses.get(id) ?? null;
  }
  async findOwned(ownerId: string, id: string) {
    const business = this.businesses.get(id);
    return business && business.ownerId === ownerId ? business : null;
  }
  async findActiveByBossEmail(email: string) {
    return [...this.businesses.values()].filter((business) => business.status === 'active' && business.boss.email === email);
  }
}

/** What the base setup contract of businesses answers: only the current boss of an ACTIVE business sees it. */
export class FakeAdministeredProfiles extends AdministeredBusinessProfiles {
  constructor(private readonly directory: FakeBusinessDirectory) {
    super();
  }
  async find(bossEmail: string, businessId: string): Promise<AdministeredBusinessProfile | null> {
    const business = this.directory.businesses.get(businessId);
    if (!business || business.status !== 'active' || business.boss.email !== bossEmail) return null;
    return {
      id: business.id,
      name: business.name,
      legalName: null,
      taxId: null,
      phone: null,
      address: null,
      supportEmail: null,
      website: null,
      category: business.category,
      categoryOther: business.categoryOther,
      currency: 'COP',
      timezone: 'America/Bogota',
      modules: [...business.modules],
      status: business.status,
    };
  }
  async updateContact(_email: string, _id: string, _change: ContactChange): Promise<AdministeredBusinessProfile | null> {
    throw new Error('not used by Turnos');
  }
  async updateCategory(_email: string, _id: string, _change: CategoryChange): Promise<AdministeredBusinessProfile | null> {
    throw new Error('not used by Turnos');
  }
}

/** In-memory configurations with the same rules as the MongoDB repository: one per business, writes checked by version. */
export class InMemoryTurnosConfigurationRepository extends TurnosConfigurationRepository {
  readonly items = new Map<string, TurnosConfiguration>();
  /** The next N `replace` calls find the configuration changed by someone else (the version moved on). */
  raceTimes = 0;
  /** How many `replace` calls were made, to check that a retry happened. */
  replaceCalls = 0;

  async find(businessId: string) {
    const item = this.items.get(businessId);
    return item ? structuredClone(item) : null;
  }

  async insert(config: TurnosConfiguration) {
    const existing = this.items.get(config.businessId);
    if (existing) return structuredClone(existing);
    this.items.set(config.businessId, structuredClone(config));
    return structuredClone(config);
  }

  async replace(expectedVersion: number, next: TurnosConfiguration) {
    this.replaceCalls += 1;
    const stored = this.items.get(next.businessId);
    if (!stored) return null;
    if (this.raceTimes > 0) {
      this.raceTimes -= 1;
      stored.version += 1;
    }
    if (stored.version !== expectedVersion) return null;
    const saved = { ...structuredClone(next), version: expectedVersion + 1 };
    this.items.set(next.businessId, saved);
    return structuredClone(saved);
  }

  async findByOperatorEmail(email: string) {
    return [...this.items.values()].filter((config) => config.operators.some((operator) => operator.email === email)).map((config) => structuredClone(config));
  }
}

/** Everything Turnos needs, with in-memory pieces: a business of Ana with Turnos, and another one of Luis. */
export function setupTurnos() {
  const clock = new FixedClock('2026-03-04T15:00:00.000Z');
  const directory = new FakeBusinessDirectory();
  directory.set(aBusiness());
  directory.set(aBusiness({ id: OTHER_BUSINESS_ID, name: 'Librería Sur', category: 'retail', boss: { assignmentId: 'assignment-2', name: 'Luis', email: OTHER_BOSS } }));
  const repository = new InMemoryTurnosConfigurationRepository();
  const store = new TurnosConfigurationStore(repository, clock);
  const service = new TurnosConfigurationService(store, directory);
  const operators = new TurnosOperatorService(store, directory);
  const source = new TurnosOperatorAccessSource(repository, { register: () => undefined } as never);
  const baseSetup = new TurnosBaseSetupService(store, new FakeAdministeredProfiles(directory));
  return { clock, directory, repository, store, service, operators, source, baseSetup };
}

export const queueInput = (name: string, extra: Record<string, unknown> = {}) => ({ name, mode: 'auto', averageMinutes: 10, ...extra });
export const operatorInput = (name: string, email: string, queueIds: string[], extra: Record<string, unknown> = {}) => ({ name, email, queueIds, ...extra });
export const names = (state: { configuration: TurnosConfiguration }) => state.configuration.queues.map((queue) => queue.name);
