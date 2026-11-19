import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { CurrentUser } from '../../../platform/security/current-user.decorator';
import { SuperAdminOnly } from '../../../platform/security/super-admin-only.decorator';
import { AuthService } from '../application/auth.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';
import { ResendRegistrationCodeDto } from './dto/resend-registration-code.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';

/** Super admin registration (confirmed with a code sent by email) and login. */
@Controller('auth/super')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Does not create the account: emails a code and answers 202 with the pending registration. */
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterSuperAdminDto) {
    return this.auth.register(dto);
  }

  /** A valid code creates the account and answers like `login`. */
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyRegistration(@Body() dto: VerifyRegistrationDto) {
    return this.auth.verifyRegistration(dto);
  }

  @Post('register/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resendRegistrationCode(@Body() dto: ResendRegistrationCodeDto) {
    return this.auth.resendRegistrationCode(dto.registrationId);
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
