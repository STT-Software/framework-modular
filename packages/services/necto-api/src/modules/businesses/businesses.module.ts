import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../../platform/events/events.module';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessesController } from './api/businesses.controller';
import { AdministeredBusinessProfilesService } from './application/administered-business-profiles.service';
import { BusinessDirectoryService, BusinessModuleAccessService } from './application/business-directory.service';
import { BusinessService } from './application/business.service';
import { BusinessDirectory, BusinessModuleAccess } from './domain/business-directory';
import { AdministeredBusinessProfiles } from './domain/business-profile-editing';
import { BusinessRepository } from './domain/business.repository';
import { BusinessRecord, BusinessSchema } from './infrastructure/business.schema';
import { MongoBusinessRepository } from './infrastructure/mongo-business.repository';

/** The businesses of each super admin, their enabled functionalities and their boss. Owns the `businesses` collection. */
@Module({
  imports: [
    SecurityModule,
    EventsModule,
    TimeModule,
    MongooseModule.forFeature([{ name: BusinessRecord.name, schema: BusinessSchema }]),
  ],
  controllers: [BusinessesController],
  providers: [
    BusinessService,
    { provide: BusinessRepository, useClass: MongoBusinessRepository },
    { provide: BusinessDirectory, useClass: BusinessDirectoryService },
    { provide: BusinessModuleAccess, useClass: BusinessModuleAccessService },
    { provide: AdministeredBusinessProfiles, useClass: AdministeredBusinessProfilesService },
  ],
  exports: [BusinessDirectory, BusinessModuleAccess, AdministeredBusinessProfiles],
})
export class BusinessesModule {}
