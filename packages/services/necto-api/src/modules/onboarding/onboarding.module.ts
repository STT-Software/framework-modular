import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../../platform/security/security.module';
import { OnboardingController } from './api/onboarding.controller';
import { OnboardingService } from './application/onboarding.service';
import { OnboardingProfileRepository } from './domain/onboarding-profile.repository';
import { MongoOnboardingProfileRepository } from './infrastructure/mongo-onboarding-profile.repository';
import { OnboardingProfileRecord, OnboardingProfileSchema } from './infrastructure/onboarding-profile.schema';

/** The phone and the origin of a user after their first login. Owns the `onboarding_profiles` collection. */
@Module({
  imports: [
    SecurityModule,
    MongooseModule.forFeature([{ name: OnboardingProfileRecord.name, schema: OnboardingProfileSchema }]),
  ],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    { provide: OnboardingProfileRepository, useClass: MongoOnboardingProfileRepository },
  ],
})
export class OnboardingModule {}
