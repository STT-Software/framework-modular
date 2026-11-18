import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../../platform/events/events.module';
import { MailModule } from '../../platform/mail/mail.module';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessesModule } from '../businesses/public';
import { accessPolicyFromConfig } from './access-policy.provider';
import { AdminAccessController } from './api/admin-access.controller';
import { BusinessAdminGuard, BusinessAdministeredGuard, BusinessModuleGuard, RecentVerificationGuard } from './api/business-admin.guards';
import { InvitationsController } from './api/invitations.controller';
import { AccessCodeService } from './application/access-code.service';
import { AccessMailer } from './application/access-mailer';
import { AdminLoginService } from './application/admin-login.service';
import { AdminSessionService } from './application/admin-session.service';
import { AdministeredBusinessesService } from './application/administered-businesses.service';
import { InvitationService } from './application/invitation.service';
import { BusinessEventsSubscriber } from './business-events.subscriber';
import { AccessPolicy } from './domain/access-policy';
import { ChallengeRepository } from './domain/challenge.repository';
import { RateLimiter } from './domain/rate-limiter';
import { SessionRepository } from './domain/session.repository';
import { AdminSessionRecord, AdminSessionSchema } from './infrastructure/admin-session.schema';
import { AccessChallengeRecord, AccessChallengeSchema } from './infrastructure/access-challenge.schema';
import { MongoAccessChallengeRepository } from './infrastructure/mongo-access-challenge.repository';
import { MongoRateLimiter } from './infrastructure/mongo-rate-limiter';
import { MongoSessionRepository } from './infrastructure/mongo-session.repository';
import { RateLimitRecord, RateLimitSchema } from './infrastructure/rate-limit.schema';

/**
 * Access of the administrators of businesses (the assigned bosses): the invitation emailed when they are assigned,
 * the one-time codes, their sessions (with an optional remembered device) and which businesses and modules they may
 * enter. Owns `access_challenges`, `access_rate_limits` and `admin_sessions`. It learns about businesses only
 * through the public door of the businesses module.
 */
@Module({
  imports: [
    SecurityModule,
    EventsModule,
    TimeModule,
    MailModule,
    BusinessesModule,
    MongooseModule.forFeature([
      { name: AccessChallengeRecord.name, schema: AccessChallengeSchema },
      { name: RateLimitRecord.name, schema: RateLimitSchema },
      { name: AdminSessionRecord.name, schema: AdminSessionSchema },
    ]),
  ],
  controllers: [AdminAccessController, InvitationsController],
  providers: [
    { provide: AccessPolicy, inject: [ConfigService], useFactory: accessPolicyFromConfig },
    { provide: ChallengeRepository, useClass: MongoAccessChallengeRepository },
    { provide: RateLimiter, useClass: MongoRateLimiter },
    { provide: SessionRepository, useClass: MongoSessionRepository },
    AccessCodeService,
    AccessMailer,
    InvitationService,
    AdministeredBusinessesService,
    AdminSessionService,
    AdminLoginService,
    BusinessAdminGuard,
    RecentVerificationGuard,
    BusinessModuleGuard,
    BusinessAdministeredGuard,
    BusinessEventsSubscriber,
  ],
  // What a module that serves a functionality needs to use `@BusinessAdminOnly()` / `@RequiresBusinessModule()` on its routes.
  exports: [AdminSessionService, AdministeredBusinessesService, BusinessAdminGuard, RecentVerificationGuard, BusinessModuleGuard, BusinessAdministeredGuard],
})
export class BusinessAccessModule {}
