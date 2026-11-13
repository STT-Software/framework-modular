import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../../platform/events/events.module';
import { MailModule } from '../../platform/mail/mail.module';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessesModule } from '../businesses/public';
import { accessPolicyFromConfig } from './access-policy.provider';
import { BossAccessController } from './api/boss-access.controller';
import { BusinessBossGuard } from './api/business-boss.guard';
import { InvitationsController } from './api/invitations.controller';
import { AccessCodeService } from './application/access-code.service';
import { AccessMailer } from './application/access-mailer';
import { BossSessionService } from './application/boss-session.service';
import { InvitationService } from './application/invitation.service';
import { BusinessEventsSubscriber } from './business-events.subscriber';
import { AccessPolicy } from './domain/access-policy';
import { ChallengeRepository } from './domain/challenge.repository';
import { RateLimiter } from './domain/rate-limiter';
import { AccessChallengeRecord, AccessChallengeSchema } from './infrastructure/access-challenge.schema';
import { MongoAccessChallengeRepository } from './infrastructure/mongo-access-challenge.repository';
import { MongoRateLimiter } from './infrastructure/mongo-rate-limiter';
import { RateLimitRecord, RateLimitSchema } from './infrastructure/rate-limit.schema';

/**
 * Access of the boss of a business: the invitation emailed when they are assigned, the one-time codes, and
 * their session. Owns the `access_challenges` and `access_rate_limits` collections. It learns about businesses
 * only through the public door of the businesses module.
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
    ]),
  ],
  controllers: [BossAccessController, InvitationsController],
  providers: [
    { provide: AccessPolicy, inject: [ConfigService], useFactory: accessPolicyFromConfig },
    { provide: ChallengeRepository, useClass: MongoAccessChallengeRepository },
    { provide: RateLimiter, useClass: MongoRateLimiter },
    AccessCodeService,
    AccessMailer,
    InvitationService,
    BossSessionService,
    BusinessBossGuard,
    BusinessEventsSubscriber,
  ],
})
export class BusinessAccessModule {}
