import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { generateCode, hmacCode, sameHmac } from '../../../platform/otp/code-hmac';
import { TokenService } from '../../../platform/security/token.service';
import { Clock } from '../../../platform/time/clock';
import {
  DuplicateSuperAdminError,
  InvalidCredentialsError,
  InvalidRegistrationCodeError,
  RegistrationCodeExpiredError,
  RegistrationResendTooSoonError,
  SuperAdminNotFoundError,
  TooManyRegistrationAttemptsError,
  TooManyRegistrationCodesError,
} from '../domain/errors';
import { REGISTRATION_CODE_PURPOSE, type PendingRegistration } from '../domain/pending-registration';
import { PendingRegistrationRepository } from '../domain/pending-registration.repository';
import { RegistrationPolicy } from '../domain/registration-policy';
import type { IdentityDocumentType, SuperAdmin } from '../domain/super-admin';
import { SuperAdminRepository } from '../domain/super-admin.repository';
import { RegistrationMailer } from './registration-mailer';

const BCRYPT_ROUNDS = 12;

export interface RegisterSuperAdminCommand {
  username: string;
  email: string;
  password: string;
  identityDocumentType: IdentityDocumentType;
  identityDocument: string;
}

export interface VerifyRegistrationCommand {
  registrationId: string;
  code: string;
}

export interface LoginCommand {
  /** Username or email, already normalized (trimmed, lowercase). */
  identifier: string;
  password: string;
}

/** What the API shows about a super admin. */
export interface SuperAdminSummary {
  id: string;
  username: string;
  email: string;
}

/** What the API answers after login or after confirming a registration. */
export interface SuperAdminSession {
  accessToken: string;
  superAdmin: SuperAdminSummary;
}

/** What the API answers while a registration waits for its code. */
export interface PendingRegistrationSummary {
  registrationId: string;
  email: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

/** Registration (confirmed with a code sent by email), login and profile of the super admin. */
@Injectable()
export class AuthService {
  /**
   * Filler hash so login takes the same time whether or not the user exists.
   * Without it, answering faster when the user does not exist would let anyone
   * find out which usernames and emails are registered.
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly superAdmins: SuperAdminRepository,
    private readonly tokens: TokenService,
    private readonly pending: PendingRegistrationRepository,
    private readonly policy: RegistrationPolicy,
    private readonly mailer: RegistrationMailer,
    private readonly clock: Clock,
  ) {}

  /**
   * Step 1: checks that nothing is taken, keeps the data aside and emails a code. The account is NOT created here.
   * A new registration with the same email or username replaces the previous pending one.
   *
   * @throws DuplicateSuperAdminError if the username, email or identity document already belong to an account.
   */
  async register(command: RegisterSuperAdminCommand): Promise<PendingRegistrationSummary> {
    const taken = await this.superAdmins.findTakenField(command);
    if (taken) {
      throw new DuplicateSuperAdminError(taken);
    }
    const now = this.clock.now();
    // The sending window of this email carries over: restarting the form does not reset the limit.
    const previous = await this.pending.findByEmail(command.email);
    const window =
      previous && now.getTime() < previous.windowStartedAt.getTime() + this.policy.sendWindowMs
        ? { sends: previous.sends + 1, windowStartedAt: previous.windowStartedAt }
        : { sends: 1, windowStartedAt: now };
    if (window.sends > this.policy.maxSendsPerWindow) {
      throw this.tooManyCodes(window.windowStartedAt, now);
    }
    const passwordHash = await hash(command.password, BCRYPT_ROUNDS);
    const expiresAt = new Date(now.getTime() + this.policy.ttlMs);
    const id = this.pending.newId();
    const code = generateCode();
    const pending: PendingRegistration = {
      id,
      username: command.username,
      email: command.email,
      identityDocumentType: command.identityDocumentType,
      identityDocument: command.identityDocument,
      passwordHash,
      termsAcceptedAt: now,
      codeHmac: this.codeHmac(id, command.email, code),
      attempts: 0,
      expiresAt,
      resendAvailableAt: new Date(now.getTime() + this.policy.resendCooldownMs),
      ...window,
      purgeAt: this.purgeAt(window.windowStartedAt, expiresAt),
    };
    await this.pending.replace(pending);
    this.mailer.dispatch({ registrationId: id, username: pending.username, email: pending.email, code });
    return this.toPendingSummary(pending);
  }

  /**
   * Step 2: a valid, current code creates the account and signs it in (same answer as `login`).
   *
   * @throws RegistrationCodeExpiredError, TooManyRegistrationAttemptsError, InvalidRegistrationCodeError, or
   *   DuplicateSuperAdminError if someone took the username, email or document in the meantime.
   */
  async verifyRegistration(command: VerifyRegistrationCommand): Promise<SuperAdminSession> {
    const pending = await this.findCurrent(command.registrationId);
    // The try is reserved before comparing: parallel requests cannot go past the limit.
    const attempts = await this.pending.reserveAttempt(pending.id, this.policy.maxAttempts);
    if (attempts === null) {
      throw new TooManyRegistrationAttemptsError();
    }
    if (!sameHmac(pending.codeHmac, this.codeHmac(pending.id, pending.email, command.code))) {
      if (attempts >= this.policy.maxAttempts) {
        throw new TooManyRegistrationAttemptsError();
      }
      throw new InvalidRegistrationCodeError();
    }
    let created: SuperAdmin;
    try {
      created = await this.superAdmins.create({
        username: pending.username,
        email: pending.email,
        identityDocumentType: pending.identityDocumentType,
        identityDocument: pending.identityDocument,
        termsAcceptedAt: pending.termsAcceptedAt,
        passwordHash: pending.passwordHash,
      });
    } catch (error) {
      // Someone took a unique value meanwhile: this registration can never succeed.
      if (error instanceof DuplicateSuperAdminError) await this.pending.delete(pending.id);
      throw error;
    }
    await this.pending.delete(pending.id);
    return this.sessionFor(created);
  }

  /**
   * Emails a new code: the previous one stops working and the tries start again.
   *
   * @throws RegistrationCodeExpiredError if the registration is gone, RegistrationResendTooSoonError during the cooldown.
   */
  async resendRegistrationCode(registrationId: string): Promise<PendingRegistrationSummary> {
    const pending = await this.findCurrent(registrationId);
    const now = this.clock.now();
    const waitMs = pending.resendAvailableAt.getTime() - now.getTime();
    if (waitMs > 0) {
      throw new RegistrationResendTooSoonError(Math.ceil(waitMs / 1000));
    }
    const windowOpen = now.getTime() < pending.windowStartedAt.getTime() + this.policy.sendWindowMs;
    if (windowOpen && pending.sends >= this.policy.maxSendsPerWindow) {
      throw this.tooManyCodes(pending.windowStartedAt, now);
    }
    const code = generateCode();
    const expiresAt = new Date(now.getTime() + this.policy.ttlMs);
    const renewed = {
      codeHmac: this.codeHmac(pending.id, pending.email, code),
      expiresAt,
      resendAvailableAt: new Date(now.getTime() + this.policy.resendCooldownMs),
      purgeAt: this.purgeAt(pending.windowStartedAt, expiresAt),
    };
    await this.pending.renewCode(pending.id, renewed);
    this.mailer.dispatch({ registrationId: pending.id, username: pending.username, email: pending.email, code });
    return this.toPendingSummary({ ...pending, ...renewed });
  }

  async login(command: LoginCommand): Promise<SuperAdminSession> {
    const admin = await this.superAdmins.findByIdentifier(command.identifier);
    const hashToCompare = admin?.passwordHash ?? (await this.getDummyHash());
    const matches = await compare(command.password, hashToCompare);
    if (!admin || !matches) {
      throw new InvalidCredentialsError();
    }
    return this.sessionFor(admin);
  }

  async getProfile(id: string): Promise<SuperAdminSummary> {
    const admin = await this.superAdmins.findById(id);
    if (!admin) {
      throw new SuperAdminNotFoundError();
    }
    return this.toSummary(admin);
  }

  /** The pending registration, if it still exists and its code has not expired. */
  private async findCurrent(registrationId: string): Promise<PendingRegistration> {
    const pending = await this.pending.findById(registrationId);
    if (!pending || pending.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new RegistrationCodeExpiredError();
    }
    return pending;
  }

  private tooManyCodes(windowStartedAt: Date, now: Date): TooManyRegistrationCodesError {
    const waitMs = windowStartedAt.getTime() + this.policy.sendWindowMs - now.getTime();
    return new TooManyRegistrationCodesError(Math.max(1, Math.ceil(waitMs / 1000)));
  }

  /** The record lives until the later of the code expiry and the end of the sending window. */
  private purgeAt(windowStartedAt: Date, codeExpiresAt: Date): Date {
    return new Date(Math.max(codeExpiresAt.getTime(), windowStartedAt.getTime() + this.policy.sendWindowMs));
  }

  private codeHmac(registrationId: string, email: string, code: string): string {
    return hmacCode(this.policy.secret, { challengeId: registrationId, email, purpose: REGISTRATION_CODE_PURPOSE }, code);
  }

  private async sessionFor(admin: SuperAdmin): Promise<SuperAdminSession> {
    return {
      accessToken: await this.tokens.issue({ userId: admin.id, role: 'superadmin' }),
      superAdmin: this.toSummary(admin),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash('filler-password', BCRYPT_ROUNDS);
    return this.dummyHash;
  }

  private toPendingSummary(pending: PendingRegistration): PendingRegistrationSummary {
    return {
      registrationId: pending.id,
      email: pending.email,
      expiresAt: pending.expiresAt,
      resendAvailableAt: pending.resendAvailableAt,
    };
  }

  private toSummary(admin: SuperAdmin): SuperAdminSummary {
    return { id: admin.id, username: admin.username, email: admin.email };
  }
}
