import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { SuperAdminDocument } from '../super-admin/schemas/super-admin.schema';
import { SuperAdminService } from '../super-admin/super-admin.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';
import type { SuperAdminJwtPayload } from './guards/super-admin.guard';

const BCRYPT_ROUNDS = 12;

export interface SuperAdminPublic {
  id: string;
  username: string;
  email: string;
}

@Injectable()
export class AuthService {
  /**
   * Filler hash so login takes the same time whether or not the user exists.
   * Without it, answering faster when the user does not exist would let anyone
   * find out which usernames and emails are registered.
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly superAdmins: SuperAdminService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterSuperAdminDto): Promise<SuperAdminPublic> {
    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    const created = await this.superAdmins.create({
      username: dto.username,
      email: dto.email,
      identityDocumentType: dto.identityDocumentType,
      identityDocument: dto.identityDocument,
      termsAcceptedAt: new Date(),
      passwordHash,
    });
    return this.toPublic(created);
  }

  async login(dto: LoginSuperAdminDto): Promise<{ accessToken: string; superAdmin: SuperAdminPublic }> {
    const admin = await this.superAdmins.findByIdentifier(dto.identifier);
    const hashToCompare = admin?.passwordHash ?? (await this.getDummyHash());
    const matches = await compare(dto.password, hashToCompare);

    // Same message for "user not found" and "wrong password".
    if (!admin || !matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: SuperAdminJwtPayload = { sub: admin.id, role: 'superadmin' };
    return {
      accessToken: await this.jwt.signAsync(payload),
      superAdmin: this.toPublic(admin),
    };
  }

  async getProfile(id: string): Promise<SuperAdminPublic> {
    const admin = await this.superAdmins.findById(id);
    if (!admin) {
      throw new NotFoundException('Super admin not found');
    }
    return this.toPublic(admin);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hash('filler-password', BCRYPT_ROUNDS);
    return this.dummyHash;
  }

  private toPublic(admin: SuperAdminDocument): SuperAdminPublic {
    return { id: admin.id, username: admin.username, email: admin.email };
  }
}
