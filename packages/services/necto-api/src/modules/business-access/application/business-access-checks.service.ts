import { Injectable } from '@nestjs/common';
import { BusinessAccessChecks } from '../domain/access-checks';
import { AccessGrantsService } from './access-grants.service';
import { AdminSessionService } from './admin-session.service';
import { AdministeredBusinessesService } from './administered-businesses.service';
@Injectable()
export class BusinessAccessChecksService extends BusinessAccessChecks {
  constructor(
    private readonly sessions: AdminSessionService,
    private readonly businesses: AdministeredBusinessesService,
    private readonly grants: AccessGrantsService,
  ) {
    super();
  }
  async requireSession(sessionId: string, email: string): Promise<void> {
    await this.sessions.requireActive(sessionId, email);
  }
  async requireAdministrator(email: string, businessId: string, moduleId: string): Promise<void> {
    await this.businesses.requireModule(email, businessId, moduleId);
  }
  async requireOperator(email: string, businessId: string, moduleId: string): Promise<void> {
    await this.grants.requireOperator(email, businessId, moduleId);
  }
}
