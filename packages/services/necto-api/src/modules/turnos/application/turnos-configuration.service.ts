import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../../platform/text/normalize';
import { BusinessDirectory, type BusinessAccessView } from '../../businesses/public';
import { suggestedProfileFor, TURNOS_MODULE_ID, type SetupStep, type TurnosProfileId } from '../domain/catalog';
import type { TurnosConfiguration } from '../domain/configuration';
import { TurnosBusinessNotFoundError, TurnosNotEnabledError } from '../domain/errors';
import {
  addOperator,
  addQueue,
  changeProfile,
  ensureSeeded,
  markReady,
  recordStep,
  removeOperator,
  removeQueue,
  setRules,
  updateOperator,
  updateQueue,
  type Reassignment,
} from '../domain/operations';
import type { OperatorInput } from '../domain/operators';
import type { QueueInput } from '../domain/queues';
import type { RulesInput } from '../domain/rules';
import { TurnosConfigurationStore } from './turnos-configuration.store';

/** The configuration of a business as the administrator sees it. */
export interface TurnosState {
  business: { id: string; name: string; category: string; categoryOther: string | null };
  /** The profile the business's category suggests (the default of the first step). */
  suggestedProfile: TurnosProfileId;
  configuration: TurnosConfiguration;
  /** The queue or operator the call just created. */
  created?: { id: string };
}

/**
 * The configuration of Turnos, done by the administrator of a business: profile, queues, general rules, operators and the review.
 * The routes already require, on every request, an administrator of THAT business with Turnos enabled; the service checks it
 * once more against the business before it reads or writes anything, so it never works on a business that is not the caller's.
 * The first time the configuration is opened, the suggestions of the profile are generated and stored once.
 */
@Injectable()
export class TurnosConfigurationService {
  constructor(
    private readonly store: TurnosConfigurationStore,
    private readonly directory: BusinessDirectory,
  ) {}

  /** Opens the configuration (generating the suggested queues the first time). */
  get(businessId: string): Promise<TurnosState> {
    return this.change(businessId, (config) => config);
  }

  changeProfile(businessId: string, profile: string, addSuggestedQueues: boolean): Promise<TurnosState> {
    return this.change(businessId, (config, now) => changeProfile(config, profile, addSuggestedQueues, now));
  }

  saveRules(businessId: string, input: RulesInput): Promise<TurnosState> {
    return this.change(businessId, (config, now) => setRules(config, input, now));
  }

  async createQueue(businessId: string, input: QueueInput): Promise<TurnosState> {
    const before = new Set<string>();
    const state = await this.change(businessId, (config, now) => {
      before.clear();
      config.queues.forEach((queue) => before.add(queue.id));
      return addQueue(config, input, now);
    });
    return { ...state, created: { id: state.configuration.queues.find((queue) => !before.has(queue.id))!.id } };
  }

  updateQueue(businessId: string, queueId: string, input: QueueInput): Promise<TurnosState> {
    return this.change(businessId, (config, now) => updateQueue(config, queueId, input, now));
  }

  deleteQueue(businessId: string, queueId: string, reassignments: readonly Reassignment[]): Promise<TurnosState> {
    return this.change(businessId, (config, now) => removeQueue(config, queueId, reassignments, now));
  }

  async createOperator(businessId: string, input: OperatorInput): Promise<TurnosState> {
    const before = new Set<string>();
    const operator = normalizedOperator(input);
    const state = await this.change(businessId, (config, now) => {
      before.clear();
      config.operators.forEach((existing) => before.add(existing.id));
      return addOperator(config, operator, now);
    });
    return { ...state, created: { id: state.configuration.operators.find((operator) => !before.has(operator.id))!.id } };
  }

  updateOperator(businessId: string, operatorId: string, input: OperatorInput): Promise<TurnosState> {
    const operator = normalizedOperator(input);
    return this.change(businessId, (config, now) => updateOperator(config, operatorId, operator, now));
  }

  deleteOperator(businessId: string, operatorId: string): Promise<TurnosState> {
    return this.change(businessId, (config, now) => removeOperator(config, operatorId, now));
  }

  saveProgress(businessId: string, step: SetupStep): Promise<TurnosState> {
    return this.change(businessId, (config, now) => recordStep(config, step, now));
  }

  /** "Guardar configuración": needs at least one queue and valid rules. Operators are optional. */
  complete(businessId: string): Promise<TurnosState> {
    return this.change(businessId, (config, now) => markReady(config, now));
  }

  private async change(
    businessId: string,
    change: (config: TurnosConfiguration, now: Date) => TurnosConfiguration,
  ): Promise<TurnosState> {
    const business = await this.requireBusiness(businessId);
    const suggestedProfile = suggestedProfileFor(business.category);
    // Seeding the suggestions the first time is itself a change that gets saved; when there is nothing new, nothing is written.
    const configuration = await this.store.update(businessId, (stored, now) => change(ensureSeeded(stored, suggestedProfile, now), now));
    return {
      business: { id: business.id, name: business.name, category: business.category, categoryOther: business.categoryOther },
      suggestedProfile,
      configuration,
    };
  }

  private async requireBusiness(businessId: string): Promise<BusinessAccessView> {
    const business = await this.directory.find(businessId);
    if (!business || business.status !== 'active') throw new TurnosBusinessNotFoundError();
    if (!business.modules.includes(TURNOS_MODULE_ID)) throw new TurnosNotEnabledError();
    return business;
  }
}

/** The email is how the person signs in, so it is compared and stored with the same normalization as the sign-in (trimmed, lowercase). */
function normalizedOperator(input: OperatorInput): OperatorInput {
  return { ...input, email: typeof input.email === 'string' ? normalizeEmail(input.email) : input.email };
}
