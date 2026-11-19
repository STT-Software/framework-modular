import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Res, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { RequiresBusinessModule } from '../../business-access/public';
import { TurnosConfigurationService } from '../application/turnos-configuration.service';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { ChangeProfileDto, DeleteQueueDto, OperatorDto, ProgressDto, QueueDto, RulesDto } from './dto/turnos.dto';
import { toTurnosResponse } from './turnos.response';

/**
 * The configuration of Turnos, for the ADMINISTRATOR of a business. Every route is under `:businessId` and is guarded by
 * `@RequiresBusinessModule('turnos')`: on every request the signed-in person must be the current boss of that active business
 * AND the business must have Turnos enabled, checked against the database (the id in the URL, the role and the modules are
 * never taken from the page). An operator, who signs in with the same code, is never let in here: being an operator of a
 * business does not make you its boss. Another business, a paused or unknown one all answer 404; Turnos not enabled, 403
 * `module-not-enabled`. Every write answers the whole configuration, as the server saved it.
 */
@Controller('turnos/businesses/:businessId')
@RequiresBusinessModule(TURNOS_MODULE_ID)
@UseInterceptors(NoStoreInterceptor)
export class TurnosController {
  constructor(private readonly turnos: TurnosConfigurationService) {}

  /** Opens the configuration. The first time it generates the suggested queues of the profile and stores them. */
  @Get()
  async get(@Param('businessId') businessId: string) {
    return toTurnosResponse(await this.turnos.get(businessId));
  }

  /** Changes the attention profile without losing queues, rules or operators (see the README for the exact rules). */
  @Put('profile')
  async changeProfile(@Param('businessId') businessId: string, @Body() dto: ChangeProfileDto) {
    return toTurnosResponse(await this.turnos.changeProfile(businessId, dto.profile, dto.addSuggestedQueues === true));
  }

  @Post('queues')
  async createQueue(@Param('businessId') businessId: string, @Body() dto: QueueDto, @Res({ passthrough: true }) response: Response) {
    const state = await this.turnos.createQueue(businessId, dto);
    response.status(201);
    return toTurnosResponse(state);
  }

  /** Replaces what is editable of the queue. A field of `overrides` that is left out or `null` goes back to the general rule. */
  @Put('queues/:queueId')
  async updateQueue(@Param('businessId') businessId: string, @Param('queueId') queueId: string, @Body() dto: QueueDto) {
    return toTurnosResponse(await this.turnos.updateQueue(businessId, queueId, dto));
  }

  /**
   * Deletes the queue. Operators who would be left without any queue need `reassignments` (409 `reassignment-required`
   * otherwise); the queue and the operators change together or not at all.
   */
  @Delete('queues/:queueId')
  async deleteQueue(@Param('businessId') businessId: string, @Param('queueId') queueId: string, @Body() dto: DeleteQueueDto) {
    return toTurnosResponse(await this.turnos.deleteQueue(businessId, queueId, dto.reassignments ?? []));
  }

  @Put('rules')
  async saveRules(@Param('businessId') businessId: string, @Body() dto: RulesDto) {
    return toTurnosResponse(await this.turnos.saveRules(businessId, dto));
  }

  @Post('operators')
  async createOperator(@Param('businessId') businessId: string, @Body() dto: OperatorDto, @Res({ passthrough: true }) response: Response) {
    const state = await this.turnos.createOperator(businessId, dto);
    response.status(201);
    return toTurnosResponse(state);
  }

  @Put('operators/:operatorId')
  async updateOperator(@Param('businessId') businessId: string, @Param('operatorId') operatorId: string, @Body() dto: OperatorDto) {
    return toTurnosResponse(await this.turnos.updateOperator(businessId, operatorId, dto));
  }

  /** Removes only the assignment to Turnos of this business: the person and their other accesses are untouched. */
  @Delete('operators/:operatorId')
  async deleteOperator(@Param('businessId') businessId: string, @Param('operatorId') operatorId: string) {
    return toTurnosResponse(await this.turnos.deleteOperator(businessId, operatorId));
  }

  /** Remembers the step the person is on, to continue from there later. It does not change the content. */
  @Put('progress')
  async saveProgress(@Param('businessId') businessId: string, @Body() dto: ProgressDto) {
    return toTurnosResponse(await this.turnos.saveProgress(businessId, dto.step));
  }

  /** "Guardar configuración": needs at least one queue and valid rules; operators are optional. */
  @Post('complete')
  @HttpCode(200)
  async complete(@Param('businessId') businessId: string) {
    return toTurnosResponse(await this.turnos.complete(businessId));
  }
}
