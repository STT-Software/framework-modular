import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../../../platform/security/authentication.guard';
import { BusinessBossGuard } from './business-boss.guard';

/** Restricts a route to the boss of an active business: authenticates the token, then checks the assignment. */
export const BossOnly = () => applyDecorators(UseGuards(AuthenticationGuard, BusinessBossGuard));
