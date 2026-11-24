import { Controller, Get, Param, Req, UseInterceptors } from '@nestjs/common';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { OperatesModule, type AdminRequest } from '../../business-access/public';
import { PedidosOperatorService } from '../application/pedidos-operator.service';
import { PEDIDOS_MODULE_ID } from '../domain/catalog';
import { toPedidosOperatorResponse } from './pedidos.response';

/**
 * Read-only operational view for a Pedidos operator (`@OperatesModule('pedidos')`).
 * Resolves the caller strictly from the verified session email and exposes only their scoped assignment.
 */
@Controller('pedidos/businesses/:businessId/operator')
@OperatesModule(PEDIDOS_MODULE_ID)
@UseInterceptors(NoStoreInterceptor)
export class PedidosOperatorController {
  constructor(private readonly operators: PedidosOperatorService) {}

  @Get()
  async me(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toPedidosOperatorResponse(await this.operators.view(request.adminSession!.email, businessId));
  }
}
