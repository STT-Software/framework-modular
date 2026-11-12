import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';
import { SuperAdminGuard, type SuperAdminRequest } from './guards/super-admin.guard';

/** Super admin authentication. The business admin login will live in its own service. */
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
  @UseGuards(SuperAdminGuard)
  me(@Req() req: SuperAdminRequest) {
    return this.auth.getProfile(req.superAdmin!.sub);
  }
}
