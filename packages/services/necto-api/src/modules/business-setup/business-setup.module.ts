import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessAccessModule } from '../business-access/public';
import { BusinessesModule } from '../businesses/public';
import { TurnosModule } from '../turnos/public';
import { BusinessSetupController } from './api/business-setup.controller';
import { BusinessSetupService } from './application/business-setup.service';
import { BusinessSetupRepository } from './domain/business-setup.repository';
import { BusinessSetupRecord, BusinessSetupSchema } from './infrastructure/business-setup.schema';
import { MongoBusinessSetupRepository } from './infrastructure/mongo-business-setup.repository';

/**
 * The initial configuration of a business, done by its administrator: assigned modules, business data, opening hours, type of
 * business and review. Owns the `business_setups` collection. The data of the business stays in `businesses` and is reached only
 * through its public contract; who may enter a business comes from `business-access`.
 */
@Module({
  imports: [
    SecurityModule,
    TimeModule,
    BusinessesModule,
    BusinessAccessModule,
    TurnosModule,
    MongooseModule.forFeature([{ name: BusinessSetupRecord.name, schema: BusinessSetupSchema }]),
  ],
  controllers: [BusinessSetupController],
  providers: [BusinessSetupService, { provide: BusinessSetupRepository, useClass: MongoBusinessSetupRepository }],
})
export class BusinessSetupModule {}
