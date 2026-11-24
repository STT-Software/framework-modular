import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessAccessModule } from '../business-access/public';
import { BusinessSetupModule } from '../business-setup/public';
import { BusinessesModule } from '../businesses/public';
import { PedidosOperatorController } from './api/pedidos-operator.controller';
import { PedidosController } from './api/pedidos.controller';
import { PedidosConfigurationService } from './application/pedidos-configuration.service';
import { PedidosConfigurationStore } from './application/pedidos-configuration.store';
import { PedidosOperatorAccessSource } from './application/pedidos-operator-access.source';
import { PedidosOperatorService } from './application/pedidos-operator.service';
import { PedidosSetupStatusSource } from './application/pedidos-setup-status.source';
import { PedidosConfigurationRepository } from './domain/pedidos-configuration.repository';
import { MongoPedidosConfigurationRepository } from './infrastructure/mongo-pedidos-configuration.repository';
import { PedidosConfigurationRecord, PedidosConfigurationSchema } from './infrastructure/pedidos-configuration.schema';

/**
 * Pedidos capability module (configuration and operator workspace view).
 * Owns the `pedidos_configurations` collection, registers its operator access source with `business-access`, and
 * registers its readiness status source with `business-setup` via IoC so there are zero module cycles.
 */
@Module({
  imports: [
    SecurityModule,
    TimeModule,
    BusinessesModule,
    BusinessAccessModule,
    BusinessSetupModule,
    MongooseModule.forFeature([{ name: PedidosConfigurationRecord.name, schema: PedidosConfigurationSchema }]),
  ],
  controllers: [PedidosController, PedidosOperatorController],
  providers: [
    { provide: PedidosConfigurationRepository, useClass: MongoPedidosConfigurationRepository },
    PedidosConfigurationStore,
    PedidosConfigurationService,
    PedidosOperatorService,
    PedidosOperatorAccessSource,
    PedidosSetupStatusSource,
  ],
})
export class PedidosModule {}
