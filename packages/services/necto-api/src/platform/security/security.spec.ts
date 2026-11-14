import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest, AuthenticatedUser } from './authenticated-user';
import { AuthenticationGuard } from './authentication.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { TokenService } from './token.service';

const SECRET = 'a'.repeat(32);

function jwt(secret = SECRET) {
  return new JwtService({ secret, signOptions: { expiresIn: '1h' } });
}

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('TokenService', () => {
  const tokens = new TokenService(jwt());

  it('verifies a token it issued and returns the identity', async () => {
    const token = await tokens.issue({ userId: 'user-1', role: 'superadmin' });
    assert.deepEqual(await tokens.verify(token), { userId: 'user-1', role: 'superadmin' });
  });

  it('rejects garbage, forged signatures, unknown roles and tokens without a subject', async () => {
    assert.equal(await tokens.verify('not-a-token'), null);
    assert.equal(await tokens.verify(await jwt('b'.repeat(32)).signAsync({ sub: 'user-1', role: 'superadmin' })), null);
    assert.equal(await tokens.verify(await jwt().signAsync({ sub: 'user-1', role: 'intruder' })), null);
    assert.equal(await tokens.verify(await jwt().signAsync({ role: 'superadmin' })), null);
  });

  it('round-trips a business boss token with its business and assignment', async () => {
    const boss: AuthenticatedUser = { userId: 'ana@x.co', role: 'business-boss', businessId: 'b1', assignmentId: 'a1' };
    assert.deepEqual(await tokens.verify(await tokens.issue(boss)), boss);
  });
  it('rejects a boss token missing its business or assignment', async () => {
    assert.equal(await tokens.verify(await jwt().signAsync({ sub: 'ana@x.co', role: 'business-boss', aid: 'a1' })), null);
    assert.equal(await tokens.verify(await jwt().signAsync({ sub: 'ana@x.co', role: 'business-boss', bid: 'b1' })), null);
  });
  it('rejects an expired token', async () => {
    const expired = await jwt().signAsync({ sub: 'user-1', role: 'superadmin' }, { expiresIn: -10 });
    assert.equal(await tokens.verify(expired), null);
  });
});

describe('AuthenticationGuard (who are you?)', () => {
  const tokens = new TokenService(jwt());
  const guard = new AuthenticationGuard(tokens);

  it('puts the identity on the request when the token is valid', async () => {
    const token = await tokens.issue({ userId: 'user-1', role: 'superadmin' });
    const request: Partial<AuthenticatedRequest> = { headers: { authorization: `Bearer ${token}` } };

    assert.equal(await guard.canActivate(contextFor(request)), true);
    assert.deepEqual(request.user, { userId: 'user-1', role: 'superadmin' });
  });

  it('answers 401 without a token, with another scheme or with an invalid token', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearer not-a-token']) {
      await assert.rejects(guard.canActivate(contextFor({ headers: { authorization } })), UnauthorizedException);
    }
  });

  it('does not decide on roles: any authenticated identity gets through', async () => {
    const otherRole = { userId: 'user-2', role: 'business-admin' } as unknown as AuthenticatedUser;
    const stub = { verify: async () => otherRole } as unknown as TokenService;
    const request: Partial<AuthenticatedRequest> = { headers: { authorization: 'Bearer x' } };

    assert.equal(await new AuthenticationGuard(stub).canActivate(contextFor(request)), true);
    assert.equal(request.user?.role, 'business-admin');
  });
});

describe('SuperAdminGuard (what can you do?)', () => {
  const guard = new SuperAdminGuard();

  it('lets a super admin through', () => {
    const user: AuthenticatedUser = { userId: 'user-1', role: 'superadmin' };
    assert.equal(guard.canActivate(contextFor({ user })), true);
  });

  it('answers 403 to an authenticated user with another role', () => {
    const user = { userId: 'user-2', role: 'business-admin' } as unknown as AuthenticatedUser;
    assert.throws(() => guard.canActivate(contextFor({ user })), ForbiddenException);
  });

  it('answers 403 to a business boss', () => {
    const user: AuthenticatedUser = { userId: 'ana@x.co', role: 'business-boss', businessId: 'b1', assignmentId: 'a1' };
    assert.throws(() => guard.canActivate(contextFor({ user })), ForbiddenException);
  });
  it('answers 401 if nobody authenticated the request first', () => {
    assert.throws(() => guard.canActivate(contextFor({})), UnauthorizedException);
  });
});
