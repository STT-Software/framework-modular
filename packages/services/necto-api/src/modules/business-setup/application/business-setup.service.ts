import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import {
  AdministeredBusinessProfiles,
  BUSINESS_MODULES,
  type AdministeredBusinessProfile,
  type BusinessCategoryId,
  type BusinessModuleId,
  type ContactChange,
} from '../../businesses/public';
import type { BusinessSetup, ModuleScheduleEntry } from '../domain/business-setup';
import { BusinessSetupRepository, type SetupPatch } from '../domain/business-setup.repository';
import { InvalidScheduleError, LogoNotFoundError, ModuleNotAssignedError, SetupBusinessNotFoundError, SetupIncompleteError } from '../domain/errors';
import { inspectLogo, type LogoFile, type LogoInfo } from '../domain/logo';
import type { SetupStep } from '../domain/setup-steps';
import { defaultWeekSchedule, isOpenAt, parseWeekSchedule, type WeekSchedule } from '../domain/week-schedule';

/** One assigned module as the setup shows it. Its own settings (queues, rules, staff...) are not part of this stage. */
export interface SetupModuleView {
  id: BusinessModuleId;
  name: string;
  description: string;
  /** Does it follow the schedule of the business? */
  inherit: boolean;
  /** The schedule it really has: the business one while it inherits, its own otherwise. */
  effectiveSchedule: WeekSchedule;
  /** Its own schedule (the exception), if it has one saved, even while it inherits. */
  ownSchedule: WeekSchedule | null;
  openNow: boolean | null;
}

export interface SetupState {
  business: AdministeredBusinessProfile;
  description: string | null;
  logo: LogoInfo | null;
  timezone: string;
  baseSchedule: WeekSchedule;
  /** False while the business still shows the default schedule because nobody saved one. */
  baseScheduleSaved: boolean;
  baseOpenNow: boolean | null;
  modules: SetupModuleView[];
  progress: { currentStep: SetupStep | null; visitedSteps: SetupStep[]; baseReady: boolean; baseReadyAt: Date | null };
}

export interface ProfileInput {
  contact: ContactChange;
  description: string | null;
}

export interface ModuleScheduleInput {
  inherit: boolean;
  /** Raw, unvalidated: the domain validates it. */
  schedule?: unknown;
}

/**
 * The initial configuration of a business, done by its administrator: which modules it has, its data, its opening hours, its
 * type and the review. Every operation starts from the administrator's email and the business id and asks the businesses
 * module (through its public contract) whether that person administers that business RIGHT NOW; the id in the URL is never
 * trusted on its own. The data of the business is read and written on the owner's business document: this module only keeps
 * what is new (description, logo, hours, progress).
 */
@Injectable()
export class BusinessSetupService {
  constructor(
    private readonly profiles: AdministeredBusinessProfiles,
    private readonly setups: BusinessSetupRepository,
    private readonly clock: Clock,
  ) {}

  /** Everything needed to open the setup again where the person left it. Reading creates nothing. */
  async get(adminEmail: string, businessId: string): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    return this.stateOf(business, await this.setups.find(businessId));
  }

  /**
   * Saves the form of "Datos del negocio": it replaces the contact data of the business (a field left out is cleared; the name
   * is required) and the description. The business document is written first and atomically checks that the person is still
   * its boss, so nothing is saved for someone who just lost access.
   */
  async saveProfile(adminEmail: string, businessId: string, input: ProfileInput): Promise<SetupState> {
    const business = await this.profiles.updateContact(adminEmail, businessId, input.contact);
    if (!business) throw new SetupBusinessNotFoundError();
    const setup = await this.setups.apply(businessId, { description: input.description, baseReadyAt: null }, this.clock.now());
    return this.stateOf(business, setup);
  }

  /** "Tipo de negocio": the category of the business. `categoryOther` is required by the request validation when it is "other". */
  async saveCategory(adminEmail: string, businessId: string, category: BusinessCategoryId, categoryOther: string | null): Promise<SetupState> {
    const business = await this.profiles.updateCategory(adminEmail, businessId, { category, categoryOther });
    if (!business) throw new SetupBusinessNotFoundError();
    return this.stateOf(business, await this.change(businessId, {}));
  }

  async saveBaseSchedule(adminEmail: string, businessId: string, rawSchedule: unknown): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    const baseSchedule = parseWeekSchedule(rawSchedule);
    return this.stateOf(business, await this.change(businessId, { baseSchedule }));
  }

  /**
   * Sets how one ASSIGNED module gets its hours. `inherit: true` makes it follow the business (its own schedule is kept, if
   * it had one). `inherit: false` makes it use its own: the one sent, or the one it already had, or a copy of the business's
   * current one to start from.
   */
  async saveModuleSchedule(adminEmail: string, businessId: string, moduleId: string, input: ModuleScheduleInput): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    const assigned = business.modules.find((id) => id === moduleId);
    if (!assigned) throw new ModuleNotAssignedError();
    const setup = await this.setups.find(businessId);
    const sent = input.schedule === undefined ? null : parseWeekSchedule(input.schedule);
    const previous = setup?.moduleSchedules[assigned]?.schedule ?? null;
    const own = sent ?? previous ?? (input.inherit ? null : structuredClone(setup?.baseSchedule ?? defaultWeekSchedule()));
    const entry: ModuleScheduleEntry = { inherit: input.inherit, schedule: own };
    return this.stateOf(business, await this.change(businessId, { moduleSchedule: { moduleId: assigned, entry } }));
  }

  async uploadLogo(adminEmail: string, businessId: string, file: { bytes: Uint8Array; declaredType?: string }): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    const logo = inspectLogo(file.bytes, file.declaredType, this.clock.now());
    return this.stateOf(business, await this.change(businessId, { logo }));
  }

  /** Removing a logo that is not there is not an error. */
  async removeLogo(adminEmail: string, businessId: string): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    return this.stateOf(business, await this.change(businessId, { logo: null }));
  }

  async getLogo(adminEmail: string, businessId: string): Promise<LogoFile> {
    await this.requireBusiness(adminEmail, businessId);
    const logo = await this.setups.findLogo(businessId);
    if (!logo) throw new LogoNotFoundError();
    return logo;
  }

  /** Remembers the step the person is on, to continue from there. It does not change what the base looks like. */
  async saveProgress(adminEmail: string, businessId: string, step: SetupStep): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    const setup = await this.setups.apply(businessId, { step }, this.clock.now());
    return this.stateOf(business, setup);
  }

  /**
   * "Guardar configuración base": marks ONLY the base configuration as ready, after checking again everything it holds. It
   * says nothing about the settings of each module, which stay pending. Repeating it keeps the original date.
   */
  async complete(adminEmail: string, businessId: string): Promise<SetupState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    const setup = await this.setups.find(businessId);
    const problems: Record<string, string[]> = {};
    if (business.name.trim().length < 2) problems['profile.name'] = ['name must be at least 2 characters long'];
    if (business.category === 'other' && (business.categoryOther ?? '').trim().length < 2) {
      problems['category.categoryOther'] = ['categoryOther is required when the category is "other"'];
    }
    const schedules: Array<[string, unknown]> = [['schedule.base', setup?.baseSchedule ?? defaultWeekSchedule()]];
    for (const id of business.modules) {
      const entry = setup?.moduleSchedules[id];
      if (entry && !entry.inherit) schedules.push([`schedule.modules.${id}`, entry.schedule]);
    }
    for (const [path, value] of schedules) {
      try {
        parseWeekSchedule(value, path);
      } catch (error) {
        if (!(error instanceof InvalidScheduleError)) throw error;
        Object.assign(problems, error.fields);
      }
    }
    if (Object.keys(problems).length > 0) throw new SetupIncompleteError(problems);
    if (setup?.baseReadyAt) return this.stateOf(business, setup);
    const now = this.clock.now();
    return this.stateOf(business, await this.setups.apply(businessId, { step: 'review', baseReadyAt: now }, now));
  }

  /** Any change to the base makes it "not ready" again: it has to be reviewed and saved once more. */
  private change(businessId: string, patch: SetupPatch): Promise<BusinessSetup> {
    return this.setups.apply(businessId, { ...patch, baseReadyAt: null }, this.clock.now());
  }

  private async requireBusiness(adminEmail: string, businessId: string): Promise<AdministeredBusinessProfile> {
    const business = await this.profiles.find(adminEmail, businessId);
    if (!business) throw new SetupBusinessNotFoundError();
    return business;
  }

  private stateOf(business: AdministeredBusinessProfile, setup: BusinessSetup | null): SetupState {
    const now = this.clock.now();
    const baseSchedule = setup?.baseSchedule ?? defaultWeekSchedule();
    const modules = BUSINESS_MODULES.filter((module) => business.modules.includes(module.id)).map((module): SetupModuleView => {
      const entry = setup?.moduleSchedules[module.id];
      const inherit = entry?.inherit ?? true;
      const effectiveSchedule = inherit || !entry?.schedule ? baseSchedule : entry.schedule;
      return {
        id: module.id,
        name: module.name,
        description: module.description,
        inherit,
        effectiveSchedule,
        ownSchedule: entry?.schedule ?? null,
        openNow: isOpenAt(effectiveSchedule, business.timezone, now),
      };
    });
    return {
      business,
      description: setup?.description ?? null,
      logo: setup?.logo ?? null,
      timezone: business.timezone,
      baseSchedule,
      baseScheduleSaved: setup?.baseSchedule != null,
      baseOpenNow: isOpenAt(baseSchedule, business.timezone, now),
      modules,
      progress: {
        currentStep: setup?.currentStep ?? null,
        visitedSteps: setup?.visitedSteps ?? [],
        baseReady: setup?.baseReadyAt != null,
        baseReadyAt: setup?.baseReadyAt ?? null,
      },
    };
  }
}
