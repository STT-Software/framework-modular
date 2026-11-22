import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, Res, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { RequiresBusinessModule, type AdminRequest } from '../../business-access/public';
import { PedidosConfigurationService } from '../application/pedidos-configuration.service';
import { PEDIDOS_MODULE_ID } from '../domain/catalog';
import {
  ChangePedidosProfileDto,
  SavePedidosProgressDto,
  UpdatePedidosFulfillmentDto,
  UpdatePedidosModalitiesDto,
  UpdatePedidosPaymentsDto,
  UpdatePedidosSlaDto,
  UpsertPedidosOperatorDto,
} from './dto/pedidos.dto';
import { toPedidosResponse } from './pedidos.response';

/**
 * Configuration endpoints for the Pedidos module, accessible only to the current administrator of an active business
 * that has `pedidos` enabled (`@RequiresBusinessModule('pedidos')`). Every mutation returns the full persisted state.
 */
@Controller('pedidos/businesses/:businessId')
@RequiresBusinessModule(PEDIDOS_MODULE_ID)
@UseInterceptors(NoStoreInterceptor)
export class PedidosController {
  constructor(private readonly pedidos: PedidosConfigurationService) {}

  @Get()
  async get(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toPedidosResponse(await this.pedidos.get(email(request), businessId));
  }

  @Put('profile')
  async changeProfile(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: ChangePedidosProfileDto,
  ) {
    return toPedidosResponse(await this.pedidos.changeProfile(email(request), businessId, dto.profile));
  }

  @Put('modalities')
  async updateModalities(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: UpdatePedidosModalitiesDto,
  ) {
    return toPedidosResponse(
      await this.pedidos.updateModalities(email(request), businessId, dto.modalities, dto.onSiteMode),
    );
  }

  @Put('fulfillment')
  async updateFulfillment(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: UpdatePedidosFulfillmentDto,
  ) {
    return toPedidosResponse(await this.pedidos.updateFulfillment(email(request), businessId, dto));
  }

  @Put('payments')
  async updatePayments(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: UpdatePedidosPaymentsDto,
  ) {
    return toPedidosResponse(await this.pedidos.updatePayments(email(request), businessId, dto));
  }

  @Put('sla')
  async updateSla(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: UpdatePedidosSlaDto,
  ) {
    return toPedidosResponse(await this.pedidos.updateSla(email(request), businessId, dto));
  }

  @Post('operators')
  async createOperator(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: UpsertPedidosOperatorDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const state = await this.pedidos.createOperator(email(request), businessId, dto);
    response.status(201);
    return toPedidosResponse(state);
  }

  @Put('operators/:operatorId')
  async updateOperator(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Param('operatorId') operatorId: string,
    @Body() dto: UpsertPedidosOperatorDto,
  ) {
    return toPedidosResponse(await this.pedidos.updateOperator(email(request), businessId, operatorId, dto));
  }

  @Delete('operators/:operatorId')
  async deleteOperator(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Param('operatorId') operatorId: string,
  ) {
    return toPedidosResponse(await this.pedidos.deleteOperator(email(request), businessId, operatorId));
  }

  @Put('progress')
  async saveProgress(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Body() dto: SavePedidosProgressDto,
  ) {
    return toPedidosResponse(
      await this.pedidos.saveProgress(email(request), businessId, dto.currentStep, dto.visitedSteps),
    );
  }

  @Post('complete')
  @HttpCode(200)
  async complete(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toPedidosResponse(await this.pedidos.complete(email(request), businessId));
  }
}

function email(request: AdminRequest): string {
  return request.adminSession!.email;
}
