import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/public';
import { OnboardingModule } from './modules/onboarding/public';
import { PlatformConfigModule } from './platform/config/config.module';
import { DatabaseModule } from './platform/database/database.module';
import { ErrorsModule } from './platform/errors/errors.module';
import { ObservabilityModule } from './platform/observability/observability.module';
import { RateLimitModule } from './platform/security/rate-limit.module';

/**
 * The whole backend: shared infrastructure (platform) plus one module per business capability.
 * A new capability is a new folder in `modules/` and one line here.
 */
@Module({
  imports: [
    // Platform: configuration, the MongoDB connection, error mapping, request limits and health.
    PlatformConfigModule,
    DatabaseModule,
    ErrorsModule,
    RateLimitModule,
    ObservabilityModule,
    // Business modules.
    AuthModule,
    OnboardingModule,
  ],
})
export class AppModule {}
