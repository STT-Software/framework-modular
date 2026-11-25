import { FixedClock } from '../../platform/time/fixed-clock.spec';
import {
  BusinessScheduleReader,
  type EffectiveModuleSchedule,
  type WeekSchedule,
} from '../business-setup/public';
import {
  AdministeredBusinessProfiles,
  BusinessDirectory,
  type AdministeredBusinessProfile,
  type BusinessAccessView,
  type CategoryChange,
  type ContactChange,
} from '../businesses/public';
import { PedidosConfigurationService } from './application/pedidos-configuration.service';
import { PedidosConfigurationStore } from './application/pedidos-configuration.store';
import { PedidosOperatorAccessSource } from './application/pedidos-operator-access.source';
import { PedidosOperatorService } from './application/pedidos-operator.service';
import { PedidosSetupStatusSource } from './application/pedidos-setup-status.source';
import type { PedidosConfiguration } from './domain/configuration';
import { PedidosConfigurationRepository } from './domain/pedidos-configuration.repository';

export const BOSS = 'ana@cafecentral.co';
export const BUSINESS_ID = 'a'.repeat(24);
export const OTHER_BOSS = 'luis@libreriasur.co';
export const OTHER_BUSINESS_ID = 'b'.repeat(24);

export function defaultTestWeek(): WeekSchedule {
  const workday = () => ({ open: true, ranges: [{ start: '08:00', end: '18:00' }] });
  return {
    mon: workday(),
    tue: workday(),
    wed: workday(),
    thu: workday(),
    fri: workday(),
    sat: { open: true, ranges: [{ start: '09:00', end: '13:00' }] },
    sun: { open: false, ranges: [] },
  };
}

export function aBusiness(overrides: Partial<BusinessAccessView> = {}): BusinessAccessView {
  return {
    id: BUSINESS_ID,
    ownerId: 'owner-1',
    name: 'Café Central',
    status: 'active',
    category: 'gastronomy',
    categoryOther: null,
    timezone: 'America/Bogota',
    modules: ['pedidos'],
    boss: { assignmentId: 'assignment-1', name: 'Ana Gómez', email: BOSS },
    ...overrides,
  };
}

export class FakeBusinessDirectory extends BusinessDirectory {
  readonly businesses = new Map<string, BusinessAccessView>();

  set(business: BusinessAccessView): void {
    this.businesses.set(business.id, business);
  }

  async find(id: string): Promise<BusinessAccessView | null> {
    return this.businesses.get(id) ?? null;
  }

  async findOwned(ownerId: string, id: string): Promise<BusinessAccessView | null> {
    const business = this.businesses.get(id);
    return business && business.ownerId === ownerId ? business : null;
  }

  async findActiveByBossEmail(email: string): Promise<BusinessAccessView[]> {
    return [...this.businesses.values()].filter(
      (business) => business.status === 'active' && business.boss.email === email,
    );
  }
}

export class FakeAdministeredProfiles extends AdministeredBusinessProfiles {
  readonly currencies = new Map<string, string>();

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
      currency: this.currencies.get(business.id) ?? 'COP',
      timezone: business.timezone ?? 'America/Bogota',
      modules: [...business.modules],
      status: business.status,
      boss: {
        name: business.boss.name,
        email: business.boss.email,
      },
    };
  }

  async updateContact(_email: string, _id: string, _change: ContactChange): Promise<AdministeredBusinessProfile | null> {
    throw new Error('not used by Pedidos');
  }

  async updateCategory(_email: string, _id: string, _change: CategoryChange): Promise<AdministeredBusinessProfile | null> {
    throw new Error('not used by Pedidos');
  }
}

export class FakeBusinessScheduleReader extends BusinessScheduleReader {
  inherit = true;
  openNow = true;
  days: WeekSchedule = defaultTestWeek();

  async forModule(_businessId: string, _moduleId: string, timezone: string): Promise<EffectiveModuleSchedule> {
    return {
      timezone,
      inherit: this.inherit,
      openNow: this.openNow,
      days: structuredClone(this.days),
    };
  }
}

export class InMemoryPedidosConfigurationRepository extends PedidosConfigurationRepository {
  readonly items = new Map<string, PedidosConfiguration>();
  raceTimes = 0;
  replaceCalls = 0;

  async findByBusinessId(businessId: string): Promise<PedidosConfiguration | null> {
    const item = this.items.get(businessId);
    return item ? structuredClone(item) : null;
  }

  async findByOperatorEmail(email: string): Promise<PedidosConfiguration[]> {
    return [...this.items.values()]
      .filter((config) => config.operators.some((operator) => operator.email === email))
      .map((config) => structuredClone(config));
  }

  async insert(config: PedidosConfiguration): Promise<PedidosConfiguration> {
    const existing = this.items.get(config.businessId);
    if (existing) return structuredClone(existing);
    this.items.set(config.businessId, structuredClone(config));
    return structuredClone(config);
  }

  async replace(expectedVersion: number, next: PedidosConfiguration): Promise<PedidosConfiguration | null> {
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
}

export function setupPedidos() {
  const clock = new FixedClock('2026-03-04T15:00:00.000Z');
  const directory = new FakeBusinessDirectory();
  directory.set(aBusiness());
  directory.set(
    aBusiness({
      id: OTHER_BUSINESS_ID,
      name: 'Librería Sur',
      category: 'retail',
      boss: { assignmentId: 'assignment-2', name: 'Luis', email: OTHER_BOSS },
    }),
  );
  const profiles = new FakeAdministeredProfiles(directory);
  const scheduleReader = new FakeBusinessScheduleReader();
  const repository = new InMemoryPedidosConfigurationRepository();
  const store = new PedidosConfigurationStore(repository, clock);
  const service = new PedidosConfigurationService(store, profiles, scheduleReader);
  const operators = new PedidosOperatorService(store, directory, scheduleReader);
  const accessSource = new PedidosOperatorAccessSource(repository, { register: () => undefined } as never);
  const statusSource = new PedidosSetupStatusSource(repository, { register: () => undefined } as never);
  return { clock, directory, profiles, scheduleReader, repository, store, service, operators, accessSource, statusSource };
}
