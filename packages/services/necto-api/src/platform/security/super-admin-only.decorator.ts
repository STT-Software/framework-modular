import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from './authentication.guard';
import { SuperAdminGuard } from './super-admin.guard';

/**
 * Restricts a controller or route to super admins: authenticates the request first, then checks the role.
 * The module that uses it must import `SecurityModule`.
 */
export const SuperAdminOnly = () => applyDecorators(UseGuards(AuthenticationGuard, SuperAdminGuard));
