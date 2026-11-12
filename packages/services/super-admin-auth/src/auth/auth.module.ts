import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SuperAdminModule } from '../super-admin/super-admin.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  imports: [
    SuperAdminModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as never },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SuperAdminGuard],
})
export class AuthModule {}
