import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './authenticated-user';

/**
 * The identity of the authenticated user, for controller parameters. Only valid on routes protected
 * by `AuthenticationGuard` (or `@SuperAdminOnly()`).
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) {
    throw new Error('CurrentUser used on a route that is not authenticated');
  }
  return user;
});
