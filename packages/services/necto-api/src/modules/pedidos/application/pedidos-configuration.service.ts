import { Injectable, Optional } from '@nestjs/common';
import { normalizeEmail } from '../../../platform/text/normalize';
import { MemberAccessRegistry } from '../../business-access/public';
import { BusinessScheduleReader, type EffectiveModuleSchedule } from '../../business-setup/public';
import { AdministeredBusinessProfiles, type AdministeredBusinessProfile } from '../../businesses/public';
import { PEDIDOS_MODULE_ID, suggestedProfileFor, type PedidosProfileId } from '../domain/catalog';
import type { PedidosConfiguration } from '../domain/configuration';
import { PedidosBusinessNotFoundError, PedidosNotEnabledError } from '../domain/errors';
import {
  addOperator,
  changeProfile,
  completeConfiguration,
  ensureSeeded,
  removeOperator,
  saveProgress,
  updateFulfillment,
  updateModalities,
  updateOperator,
  updatePayments,
  updateSla,
} from '../domain/operations';
import type { FulfillmentInput, PaymentsInput, PedidosOperatorInput, SlaInput } from '../domain/validation';
import { PedidosConfigurationStore } from './pedidos-configuration.store';

export interface PedidosOperatorCandidate {
  name: string;
  email: string;
  phone: string | null;
  sources: string[];
}

/** Full Pedidos configuration state returned to the business administrator. */
export interface PedidosState {
  business: {
    id: string;
    name: string;
    category: string;
    categoryOther: string | null;
    currency: string;
    timezone: string;
  };
  suggestedProfile: PedidosProfileId;
  schedule: EffectiveModuleSchedule;
  configuration: PedidosConfiguration;
  candidateOperators?: PedidosOperatorCandidate[];
  /** Set on POST /operators to identify the newly created operator. */
  created?: { id: string };
}

/**
 * Manages the Pedidos configuration of a business on behalf of its current administrator.
 * Every operation re-verifies ownership and active module status via `AdministeredBusinessProfiles` using the session
 * email, seeds category defaults on first open, and hydrates the effective schedule from `BusinessScheduleReader`.
 */
@Injectable()
export class PedidosConfigurationService {
  constructor(
    private readonly store: PedidosConfigurationStore,
    private readonly profiles: AdministeredBusinessProfiles,
    private readonly scheduleReader: BusinessScheduleReader,
    @Optional() private readonly memberRegistry?: MemberAccessRegistry,
  ) {}

  get(adminEmail: string, businessId: string): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config) => config);
  }

  changeProfile(adminEmail: string, businessId: string, profile: string): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => changeProfile(config, profile, now));
  }

  updateModalities(
    adminEmail: string,
    businessId: string,
    modalities: readonly string[],
    onSiteMode: string,
  ): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => updateModalities(config, modalities, onSiteMode, now));
  }

  updateFulfillment(adminEmail: string, businessId: string, input: FulfillmentInput): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => updateFulfillment(config, input, now));
  }

  updatePayments(adminEmail: string, businessId: string, input: PaymentsInput): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => updatePayments(config, input, now));
  }

  updateSla(adminEmail: string, businessId: string, input: SlaInput): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => updateSla(config, input, now));
  }

  async createOperator(adminEmail: string, businessId: string, input: PedidosOperatorInput): Promise<PedidosState> {
    const before = new Set<string>();
    const normalized = normalizedOperator(input);
    const state = await this.change(adminEmail, businessId, (config, now) => {
      before.clear();
      config.operators.forEach((existing) => before.add(existing.id));
      return addOperator(config, normalized, now);
    });
    return {
      ...state,
      created: { id: state.configuration.operators.find((operator) => !before.has(operator.id))!.id },
    };
  }

  updateOperator(
    adminEmail: string,
    businessId: string,
    operatorId: string,
    input: PedidosOperatorInput,
  ): Promise<PedidosState> {
    const normalized = normalizedOperator(input);
    return this.change(adminEmail, businessId, (config, now) => updateOperator(config, operatorId, normalized, now));
  }

  deleteOperator(adminEmail: string, businessId: string, operatorId: string): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => removeOperator(config, operatorId, now));
  }

  saveProgress(
    adminEmail: string,
    businessId: string,
    currentStep: string,
    visitedSteps?: readonly string[],
  ): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => saveProgress(config, currentStep, visitedSteps, now));
  }

  complete(adminEmail: string, businessId: string): Promise<PedidosState> {
    return this.change(adminEmail, businessId, (config, now) => completeConfiguration(config, now));
  }

  private async change(
    adminEmail: string,
    businessId: string,
    transform: (config: PedidosConfiguration, now: Date) => PedidosConfiguration,
  ): Promise<PedidosState> {
    const business = await this.requireBusiness(adminEmail, businessId);
    const suggestedProfile = suggestedProfileFor(business.category);
    const configuration = await this.store.update(businessId, (stored, now) =>
      transform(ensureSeeded(stored, suggestedProfile, now), now),
    );
    const [schedule, candidateOperators] = await Promise.all([
      this.scheduleReader.forModule(business.id, PEDIDOS_MODULE_ID, business.timezone),
      this.collectCandidateOperators(business),
    ]);
    return {
      business: {
        id: business.id,
        name: business.name,
        category: business.category,
        categoryOther: business.categoryOther,
        currency: business.currency,
        timezone: business.timezone,
      },
      suggestedProfile,
      schedule,
      configuration,
      candidateOperators,
    };
  }

  private async collectCandidateOperators(business: AdministeredBusinessProfile): Promise<PedidosOperatorCandidate[]> {
    const byEmail = new Map<string, PedidosOperatorCandidate>();
    if (business.boss?.email && business.boss?.name) {
      const email = normalizeEmail(business.boss.email);
      byEmail.set(email, {
        name: business.boss.name,
        email,
        phone: business.phone ?? null,
        sources: ['admin'],
      });
    }
    const members = this.memberRegistry ? await this.memberRegistry.membersOfBusiness(business.id) : [];
    for (const member of members) {
      if (member.moduleId === PEDIDOS_MODULE_ID) continue;
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

  private async requireBusiness(adminEmail: string, businessId: string): Promise<AdministeredBusinessProfile> {
    const business = await this.profiles.find(adminEmail, businessId);
    if (!business || business.status !== 'active') throw new PedidosBusinessNotFoundError();
    if (!business.modules.includes(PEDIDOS_MODULE_ID)) throw new PedidosNotEnabledError();
    return business;
  }
}

function normalizedOperator(input: PedidosOperatorInput): PedidosOperatorInput {
  return { ...input, email: typeof input.email === 'string' ? normalizeEmail(input.email) : input.email };
}
