import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { OnboardingController } from './api/onboarding.controller';
import { OnboardingService } from './application/onboarding.service';
import { OnboardingProfileRepository } from './domain/onboarding-profile.repository';
import { MongoOnboardingProfileRepository } from './infrastructure/mongo-onboarding-profile.repository';
import { IntroViewRecord, IntroViewSchema } from './infrastructure/intro-view.schema';
import { OnboardingProfileRecord, OnboardingProfileSchema } from './infrastructure/onboarding-profile.schema';

/**
 * The phone and the origin of a user after their first login, and whether they already saw the welcome intro.
 * Owns the `onboarding_profiles` and `onboarding_intro_views` collections.
 */
@Module({
  imports: [
    SecurityModule,
    TimeModule,
    MongooseModule.forFeature([
      { name: OnboardingProfileRecord.name, schema: OnboardingProfileSchema },
      { name: IntroViewRecord.name, schema: IntroViewSchema },
    ]),
  ],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    { provide: OnboardingProfileRepository, useClass: MongoOnboardingProfileRepository },
  ],
})
export class OnboardingModule {}
