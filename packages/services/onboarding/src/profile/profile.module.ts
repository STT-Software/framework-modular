import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { OnboardingProfile, OnboardingProfileSchema } from './schemas/onboarding-profile.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: OnboardingProfile.name, schema: OnboardingProfileSchema }]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
