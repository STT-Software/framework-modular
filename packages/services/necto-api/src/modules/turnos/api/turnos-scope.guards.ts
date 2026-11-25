import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, UseGuards, applyDecorators, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRequest } from '../../business-access/public';
import { TurnosAccessService, type TurnosScope } from '../application/turnos-access.service';
import type { OperatorViewId } from '../domain/catalog';
/** A request after the scope guards: what this person may reach in Turnos, decided on the server. */
export type ScopedRequest = AdminRequest & { turnosScope?: TurnosScope };
const VIEW_KEY = 'turnos:operator-view';
/**
 * Declares which view of the operator's workspace a route belongs to. The operator needs the permission for at least one of them, checked
 * against what the administrator has granted right now (so a permission taken away is gone on the next request, in a session that is open).
 */
export const RequiresView = (...views: OperatorViewId[]) => SetMetadata(VIEW_KEY, views);
/**
 * After the guards of business-access (which proved this person is an operator of THIS business with Turnos enabled), finds the operator's
 * own assignment by the email of the session and keeps their scope for the route: pending, switched-off or view-less operators are refused
 * here, and so is a view they were not given. Nothing about role, business, view or queues is ever read from the request body or the URL
 * beyond the business id the earlier guard already verified.
 */
@Injectable()
export class TurnosOperatorScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: TurnosAccessService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const email = request.adminSession?.email;
    if (!email) throw new UnauthorizedException();
    const views = this.reflector.get<OperatorViewId[] | undefined>(VIEW_KEY, context.getHandler());
    request.turnosScope = await this.access.forOperator(email, request.params.businessId, views);
    return true;
  }
}
/** After `@RequiresBusinessModule`: the administrator's scope (every queue, every view). */
@Injectable()
export class TurnosAdminScopeGuard implements CanActivate {
  constructor(private readonly access: TurnosAccessService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const email = request.adminSession?.email;
    if (!email) throw new UnauthorizedException();
    request.turnosScope = await this.access.forAdmin(email, request.params.businessId);
    return true;
  }
}
export const UsesOperatorScope = () => applyDecorators(UseGuards(TurnosOperatorScopeGuard));
export const UsesAdminScope = () => applyDecorators(UseGuards(TurnosAdminScopeGuard));
/** The scope the guards worked out for this request. */
export const Scope = createParamDecorator((_data: unknown, context: ExecutionContext): TurnosScope => {
  const scope = context.switchToHttp().getRequest<ScopedRequest>().turnosScope;
  if (!scope) throw new UnauthorizedException();
  return scope;
});
