import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../../platform/events/events.module';
import { MailModule } from '../../platform/mail/mail.module';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessAccessModule } from '../business-access/public';
import { BusinessesModule } from '../businesses/public';
import { TurnosInsightsController } from './api/turnos-insights.controller';
import { TurnosOperationController } from './api/turnos-operation.controller';
import { TurnosOperatorController } from './api/turnos-operator.controller';
import { TurnosAdminScopeGuard, TurnosOperatorScopeGuard } from './api/turnos-scope.guards';
import { TurnosSurveyController } from './api/turnos-survey.controller';
import { TurnosController } from './api/turnos.controller';
import { TurnosAccessService } from './application/turnos-access.service';
import { TurnosConfigurationService } from './application/turnos-configuration.service';
import { TurnosConfigurationStore } from './application/turnos-configuration.store';
import { TurnosDashboardService } from './application/turnos-dashboard.service';
import { TurnosInsightsService } from './application/turnos-insights.service';
import { TurnosOperatorAccessSource } from './application/turnos-operator-access.source';
import { TurnosOperatorActivation } from './application/turnos-operator-activation';
import { TurnosOperatorService } from './application/turnos-operator.service';
import { TurnosBaseSetupService } from './application/turnos-base-setup.service';
import { TurnosRealtimeHub } from './application/turnos-realtime.hub';
import { TurnosSettingsService } from './application/turnos-settings.service';
import { TurnosStreamService } from './application/turnos-stream.service';
import { TurnosSurveyService } from './application/turnos-survey.service';
import { TurnosTicketService } from './application/turnos-ticket.service';
import { SurveyRepository } from './domain/survey.repository';
import { TicketRepository } from './domain/ticket.repository';
import { TurnosConfigurationRepository } from './domain/turnos-configuration.repository';
import { TurnosBaseSetup } from './domain/turnos-base-setup';
import { TurnosDashboard } from './domain/turnos-dashboard';
import { MongoSurveyRepository } from './infrastructure/mongo-survey.repository';
import { MongoTicketRepository } from './infrastructure/mongo-ticket.repository';
import { SurveyRecord, SurveySchema } from './infrastructure/survey.schema';
import { TicketCounterRecord, TicketCounterSchema, TicketRecord, TicketSchema } from './infrastructure/ticket.schema';
import { TurnosConfigurationRecord, TurnosConfigurationSchema } from './infrastructure/turnos-configuration.schema';
import { MongoTurnosConfigurationRepository } from './infrastructure/mongo-turnos-configuration.repository';
/**
 * The Turnos module of a business: its CONFIGURATION (attention profile, queues with their extra fields, general rules, operators and what
 * each may see) and its OPERATION (creating, calling and completing turns, the dashboards and the report, the room screen settings, the
 * satisfaction surveys and the live updates). Owns the collections `turnos_configurations`, `turnos_tickets`, `turnos_counters` and
 * `turnos_surveys`. It learns about businesses only through the public door of `businesses`, and serves its operators through
 * `business-access` (the same login as the administrators): it registers itself there as the source of operator assignments, and
 * listens to the first sign-in of each operator to activate them.
 */
@Module({
  imports: [
    SecurityModule,
    TimeModule,
    EventsModule,
    MailModule,
    BusinessesModule,
    BusinessAccessModule,
    MongooseModule.forFeature([
      { name: TurnosConfigurationRecord.name, schema: TurnosConfigurationSchema },
      { name: TicketRecord.name, schema: TicketSchema },
      { name: TicketCounterRecord.name, schema: TicketCounterSchema },
      { name: SurveyRecord.name, schema: SurveySchema },
    ]),
  ],
  controllers: [TurnosController, TurnosOperatorController, TurnosOperationController, TurnosInsightsController, TurnosSurveyController],
  providers: [
    { provide: TurnosConfigurationRepository, useClass: MongoTurnosConfigurationRepository },
    { provide: TicketRepository, useClass: MongoTicketRepository },
    { provide: SurveyRepository, useClass: MongoSurveyRepository },
    TurnosConfigurationStore,
    TurnosRealtimeHub,
    TurnosAccessService,
    TurnosSurveyService,
    TurnosTicketService,
    TurnosConfigurationService,
    TurnosOperatorService,
    TurnosInsightsService,
    TurnosSettingsService,
    TurnosStreamService,
    TurnosOperatorAccessSource,
    TurnosOperatorActivation,
    TurnosOperatorScopeGuard,
    TurnosAdminScopeGuard,
    { provide: TurnosBaseSetup, useClass: TurnosBaseSetupService },
    { provide: TurnosDashboard, useClass: TurnosDashboardService },
  ],
  exports: [TurnosBaseSetup, TurnosDashboard],
})
export class TurnosModule {}
