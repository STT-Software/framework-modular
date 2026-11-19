import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../../platform/mail/mail.module';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { AuthController } from './api/auth.controller';
import { AuthService } from './application/auth.service';
import { RegistrationMailer } from './application/registration-mailer';
import { PendingRegistrationRepository } from './domain/pending-registration.repository';
import { RegistrationPolicy } from './domain/registration-policy';
import { SuperAdminRepository } from './domain/super-admin.repository';
import { MongoPendingRegistrationRepository } from './infrastructure/mongo-pending-registration.repository';
import { MongoSuperAdminRepository } from './infrastructure/mongo-super-admin.repository';
import { PendingRegistrationRecord, PendingRegistrationSchema } from './infrastructure/pending-registration.schema';
import { SuperAdminRecord, SuperAdminSchema } from './infrastructure/super-admin.schema';
import { registrationPolicyFromConfig } from './registration-policy.provider';

/**
 * Super admin registration (confirmed with a code sent by email) and login.
 * Owns the `super_admins` and `pending_registrations` collections.
 */
@Module({
  imports: [
    SecurityModule,
    TimeModule,
    MailModule,
    MongooseModule.forFeature([
      { name: SuperAdminRecord.name, schema: SuperAdminSchema },
      { name: PendingRegistrationRecord.name, schema: PendingRegistrationSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RegistrationMailer,
    { provide: RegistrationPolicy, inject: [ConfigService], useFactory: registrationPolicyFromConfig },
    { provide: SuperAdminRepository, useClass: MongoSuperAdminRepository },
    { provide: PendingRegistrationRepository, useClass: MongoPendingRegistrationRepository },
  ],
})
export class AuthModule {}
