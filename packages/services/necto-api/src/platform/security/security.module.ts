import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticationGuard } from './authentication.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { TokenService } from './token.service';

/**
 * Sessions and access control for the whole backend. The JWT secret and its expiry are configured
 * here and nowhere else; `JwtModule` is not exported, so modules cannot touch tokens directly.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') as never },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [TokenService, AuthenticationGuard, SuperAdminGuard],
  exports: [TokenService, AuthenticationGuard, SuperAdminGuard],
})
export class SecurityModule {}
