import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { TokenService } from '../../../platform/security/token.service';
import { InvalidCredentialsError, SuperAdminNotFoundError } from '../domain/errors';
import type { IdentityDocumentType, SuperAdmin } from '../domain/super-admin';
import { SuperAdminRepository } from '../domain/super-admin.repository';

const BCRYPT_ROUNDS = 12;

export interface RegisterSuperAdminCommand {
  username: string;
  email: string;
  password: string;
  identityDocumentType: IdentityDocumentType;
  identityDocument: string;
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

/** Registration, login and profile of the super admin. */
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
  ) {}

  async register(command: RegisterSuperAdminCommand): Promise<SuperAdminSummary> {
    const passwordHash = await hash(command.password, BCRYPT_ROUNDS);
    const created = await this.superAdmins.create({
      username: command.username,
      email: command.email,
      identityDocumentType: command.identityDocumentType,
      identityDocument: command.identityDocument,
      termsAcceptedAt: new Date(),
      passwordHash,
    });
    return this.toSummary(created);
  }

  async login(command: LoginCommand): Promise<{ accessToken: string; superAdmin: SuperAdminSummary }> {
    const admin = await this.superAdmins.findByIdentifier(command.identifier);
    const hashToCompare = admin?.passwordHash ?? (await this.getDummyHash());
    const matches = await compare(command.password, hashToCompare);
    if (!admin || !matches) {
      throw new InvalidCredentialsError();
    }
    return {
      accessToken: await this.tokens.issue({ userId: admin.id, role: 'superadmin' }),
      superAdmin: this.toSummary(admin),
    };
  }

  async getProfile(id: string): Promise<SuperAdminSummary> {
    const admin = await this.superAdmins.findById(id);
    if (!admin) {
      throw new SuperAdminNotFoundError();
    }
    return this.toSummary(admin);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash('filler-password', BCRYPT_ROUNDS);
    return this.dummyHash;
  }

  private toSummary(admin: SuperAdmin): SuperAdminSummary {
    return { id: admin.id, username: admin.username, email: admin.email };
  }
}
