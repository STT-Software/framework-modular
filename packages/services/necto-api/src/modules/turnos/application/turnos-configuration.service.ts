import { Injectable, Optional } from '@nestjs/common';
import { normalizeEmail } from '../../../platform/text/normalize';
import { MemberAccessRegistry } from '../../business-access/public';
import { BusinessDirectory, type BusinessAccessView } from '../../businesses/public';
import { suggestedProfileFor, TURNOS_MODULE_ID, type SetupStep, type TurnosProfileId } from '../domain/catalog';
import type { TurnosConfiguration } from '../domain/configuration';
import { QueueHasOpenTurnsError, TurnosBusinessNotFoundError, TurnosNotEnabledError } from '../domain/errors';
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
import { Clock } from '../../../platform/time/clock';
import { TurnosConfigurationStore } from './turnos-configuration.store';
import { TurnosRealtimeHub } from './turnos-realtime.hub';
import { TurnosTicketService } from './turnos-ticket.service';

export interface TurnosOperatorCandidate {
  name: string;
  email: string;
  phone: string | null;
  sources: string[];
}

/** The configuration of a business as the administrator sees it. */
export interface TurnosState {
  business: { id: string; name: string; category: string; categoryOther: string | null };
  /** The profile the business's category suggests (the default of the first step). */
  suggestedProfile: TurnosProfileId;
  configuration: TurnosConfiguration;
  candidateOperators?: TurnosOperatorCandidate[];
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
    private readonly tickets: TurnosTicketService,
    private readonly hub: TurnosRealtimeHub,
    private readonly clock: Clock,
    @Optional() private readonly memberRegistry?: MemberAccessRegistry,
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

  async deleteQueue(businessId: string, queueId: string, reassignments: readonly Reassignment[]): Promise<TurnosState> {
    // A queue with people waiting or being attended cannot disappear from under them.
    if ((await this.tickets.countOpen(businessId, queueId)) > 0) throw new QueueHasOpenTurnsError();
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
    let before: TurnosConfiguration | null = null;
    // Seeding the suggestions the first time is itself a change that gets saved; when there is nothing new, nothing is written.
    const configuration = await this.store.update(businessId, (stored, now) => {
      before = stored;
      return change(ensureSeeded(stored, suggestedProfile, now), now);
    });
    if (before) await this.announce(before, configuration);
    const candidateOperators = await this.collectCandidateOperators(business);
    return {
      business: { id: business.id, name: business.name, category: business.category, categoryOther: business.categoryOther },
      suggestedProfile,
      configuration,
      candidateOperators,
    };
  }

  /**
   * Tells the live connections that the configuration changed, and each operator whose permissions changed (so their open session reads
   * the new ones). An operator who can no longer hold the turn they were attending gives it back to the line.
   */
  private async announce(before: TurnosConfiguration, after: TurnosConfiguration): Promise<void> {
    if (before.version === after.version) return;
    const at = this.clock.now();
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const touched = new Set<string>();
    for (const operator of before.operators) {
      const current = after.operators.find((candidate) => candidate.id === operator.id);
      if (!current || !same([operator.status, operator.views, operator.queueIds], [current.status, current.views, current.queueIds])) touched.add(operator.id);
    }
    for (const operatorId of touched) {
      await this.tickets.releaseIfUnauthorized(after.businessId, operatorId).catch(() => null);
      this.hub.publish({ type: 'access.changed', businessId: after.businessId, at, queueId: null, operatorId });
    }
    this.hub.publish({ type: 'config.updated', businessId: after.businessId, at, queueId: null });
  }

  private async collectCandidateOperators(business: BusinessAccessView): Promise<TurnosOperatorCandidate[]> {
    const byEmail = new Map<string, TurnosOperatorCandidate>();
    if (business.boss?.email && business.boss?.name) {
      const email = normalizeEmail(business.boss.email);
      byEmail.set(email, {
        name: business.boss.name,
        email,
        phone: null,
        sources: ['admin'],
      });
    }
    const members = this.memberRegistry ? await this.memberRegistry.membersOfBusiness(business.id) : [];
    for (const member of members) {
      if (member.moduleId === TURNOS_MODULE_ID) continue;
      const email = normalizeEmail(member.email);
      const existing = byEmail.get(email);
      if (existing) {
        if (!existing.sources.includes(member.moduleId)) existing.sources.push(member.moduleId);
        if (member.phone) existing.phone = member.phone;
      } else {
        byEmail.set(email, {
          name: member.name,
          email,
          phone: member.phone ?? null,
          sources: [member.moduleId],
        });
      }
    }
    return [...byEmail.values()];
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
