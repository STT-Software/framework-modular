import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../../platform/text/normalize';
import { BusinessScheduleReader } from '../../business-setup/public';
import { BusinessDirectory } from '../../businesses/public';
import {
  PEDIDOS_MODULE_ID,
  type ConfirmationMode,
  type OperatorStage,
  type PedidosModality,
} from '../domain/catalog';
import { PedidosBusinessNotFoundError, PedidosOperatorNotFoundError } from '../domain/errors';
import { PedidosConfigurationStore } from './pedidos-configuration.store';

const FALLBACK_TIMEZONE = 'America/Bogota';

/** Strictly scoped payload visible to a Pedidos operator: never leaks admin settings or sibling operators. */
export interface PedidosOperatorView {
  business: { id: string; name: string };
  operator: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    stages: OperatorStage[];
  };
  schedule: {
    timezone: string;
    inherit: boolean;
    openNow: boolean;
  };
  modalities: PedidosModality[];
  confirmationMode: ConfirmationMode;
}

/**
 * Operator view of Pedidos. The route already enforces `@OperatesModule('pedidos')` on every request; this service
 * resolves the operator strictly from the authenticated session email and returns only their scoped operational view.
 */
@Injectable()
export class PedidosOperatorService {
  constructor(
    private readonly store: PedidosConfigurationStore,
    private readonly directory: BusinessDirectory,
    private readonly scheduleReader: BusinessScheduleReader,
  ) {}

  async view(operatorEmail: string, businessId: string): Promise<PedidosOperatorView> {
    const email = normalizeEmail(operatorEmail);
    const [business, config] = await Promise.all([
      this.directory.find(businessId),
      this.store.findByBusinessId(businessId),
    ]);
    if (!business || business.status !== 'active' || !business.modules.includes(PEDIDOS_MODULE_ID) || !config) {
      throw new PedidosBusinessNotFoundError();
    }
    const operator = config.operators.find((candidate) => candidate.email === email);
    if (!operator || operator.stages.length === 0) {
      throw new PedidosOperatorNotFoundError();
    }
    const schedule = await this.scheduleReader.forModule(
      business.id,
      PEDIDOS_MODULE_ID,
      business.timezone ?? FALLBACK_TIMEZONE,
    );
    return {
      business: { id: business.id, name: business.name },
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        phone: operator.phone,
        stages: [...operator.stages],
      },
      schedule: {
        timezone: schedule.timezone,
        inherit: schedule.inherit,
        openNow: schedule.openNow,
      },
      modalities: [...config.modalities],
      confirmationMode: config.fulfillment.confirmationMode,
    };
  }
}
