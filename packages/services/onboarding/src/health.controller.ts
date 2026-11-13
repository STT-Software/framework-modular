import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'onboarding', timestamp: new Date().toISOString() };
  }
}
