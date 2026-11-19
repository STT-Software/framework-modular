import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessAccessModule } from '../business-access/public';
import { BusinessesModule } from '../businesses/public';
import { TurnosOperatorController } from './api/turnos-operator.controller';
import { TurnosController } from './api/turnos.controller';
import { TurnosConfigurationService } from './application/turnos-configuration.service';
import { TurnosConfigurationStore } from './application/turnos-configuration.store';
import { TurnosOperatorAccessSource } from './application/turnos-operator-access.source';
import { TurnosOperatorService } from './application/turnos-operator.service';
import { TurnosBaseSetupService } from './application/turnos-base-setup.service';
import { TurnosConfigurationRepository } from './domain/turnos-configuration.repository';
import { TurnosBaseSetup } from './domain/turnos-base-setup';
import { TurnosConfigurationRecord, TurnosConfigurationSchema } from './infrastructure/turnos-configuration.schema';
import { MongoTurnosConfigurationRepository } from './infrastructure/mongo-turnos-configuration.repository';

/**
 * The Turnos module of a business, for now only its CONFIGURATION: attention profile, queues, general rules and operators.
 * Owns the `turnos_configurations` collection. It learns about businesses only through the public door of `businesses`, and
 * serves its operators through `business-access` (the same login as the administrators): it registers itself there as the
 * source of operator assignments when it starts. Issuing and calling turns, the room screen and statistics come later.
 */
@Module({
  imports: [
    SecurityModule,
    TimeModule,
    BusinessesModule,
    BusinessAccessModule,
    MongooseModule.forFeature([{ name: TurnosConfigurationRecord.name, schema: TurnosConfigurationSchema }]),
  ],
  controllers: [TurnosController, TurnosOperatorController],
  providers: [
    { provide: TurnosConfigurationRepository, useClass: MongoTurnosConfigurationRepository },
    TurnosConfigurationStore,
    TurnosConfigurationService,
    TurnosOperatorService,
    TurnosOperatorAccessSource,
    { provide: TurnosBaseSetup, useClass: TurnosBaseSetupService },
  ],
  exports: [TurnosBaseSetup],
})
export class TurnosModule {}
