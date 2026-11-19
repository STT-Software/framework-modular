import { Controller, Get, Param, Req, UseInterceptors } from '@nestjs/common';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { OperatesModule, type AdminRequest } from '../../business-access/public';
import { TurnosOperatorService } from '../application/turnos-operator.service';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { toOperatorResponse } from './turnos.response';

/**
 * What an OPERATOR of Turnos sees. It is guarded by `@OperatesModule('turnos')`: on every request the signed-in person must be
 * assigned as an operator of that business, the business must be active and Turnos enabled. The operator is found by the email of
 * the session, never by anything the page sends, and the answer holds only their own queues: no rules, no other operators, no
 * administrative route. Everything else about Turnos (issuing and calling turns) is a later stage.
 */
@Controller('turnos/businesses/:businessId/operator')
@OperatesModule(TURNOS_MODULE_ID)
@UseInterceptors(NoStoreInterceptor)
export class TurnosOperatorController {
  constructor(private readonly operators: TurnosOperatorService) {}

  @Get()
  async me(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toOperatorResponse(await this.operators.view(request.adminSession!.email, businessId));
  }
}
