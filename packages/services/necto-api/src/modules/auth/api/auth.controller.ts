import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { CurrentUser } from '../../../platform/security/current-user.decorator';
import { SuperAdminOnly } from '../../../platform/security/super-admin-only.decorator';
import { AuthService } from '../application/auth.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';

/** Super admin registration and login. The business admin login will be another controller or module. */
@Controller('auth/super')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterSuperAdminDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginSuperAdminDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @SuperAdminOnly()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.userId);
  }
}
