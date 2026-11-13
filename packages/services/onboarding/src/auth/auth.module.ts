import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SuperAdminGuard } from './super-admin.guard';

/** Only verifies tokens (never signs them): the login lives in super-admin-auth. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // Accept only the algorithm super-admin-auth signs with.
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [SuperAdminGuard],
  exports: [SuperAdminGuard, JwtModule],
})
export class AuthModule {}
