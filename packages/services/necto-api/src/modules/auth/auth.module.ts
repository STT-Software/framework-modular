import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../../platform/security/security.module';
import { AuthController } from './api/auth.controller';
import { AuthService } from './application/auth.service';
import { SuperAdminRepository } from './domain/super-admin.repository';
import { MongoSuperAdminRepository } from './infrastructure/mongo-super-admin.repository';
import { SuperAdminRecord, SuperAdminSchema } from './infrastructure/super-admin.schema';

/** Super admin registration and login. Owns the `super_admins` collection. */
@Module({
  imports: [
    SecurityModule,
    MongooseModule.forFeature([{ name: SuperAdminRecord.name, schema: SuperAdminSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: SuperAdminRepository, useClass: MongoSuperAdminRepository }],
})
export class AuthModule {}
