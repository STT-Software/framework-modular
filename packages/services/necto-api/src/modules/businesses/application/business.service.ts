import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus';
import { Clock } from '../../../platform/time/clock';
import type { Business, BusinessDraft, BusinessProfile, BossAssignment, BusinessStatus } from '../domain/business';
import { BusinessRepository, type ListQuery } from '../domain/business.repository';
import { BusinessNotFoundError, ConcurrentModificationError } from '../domain/errors';
import { BossAssigned } from '../domain/events';
import { normalizeEmail } from '../../../platform/text/normalize';
import { toCsv } from './csv';
import { fingerprintOf } from './fingerprint';

export interface CreatedBusiness {
  business: Business;
  /** True when this call created it; false when it was a repeat of an earlier request with the same key. */
  created: boolean;
}

/** Hard cap for one CSV export, so a huge directory cannot exhaust the server. */
const EXPORT_LIMIT = 10_000;

const CSV_HEADER = [
  'Nombre comercial', 'Razón social', 'NIT / ID fiscal', 'Teléfono', 'Dirección', 'Correo de asistencia', 'Sitio web',
  'Categoría', 'Moneda', 'Zona horaria', 'Módulos', 'Estado', 'Jefe', 'Correo del jefe', 'Creado',
] as const;

/** Creating, listing, editing, pausing and exporting the businesses of a super admin. */
@Injectable()
export class BusinessService {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  /**
   * Creates a business with its boss. Safe to repeat: the same owner and Idempotency-Key return the same
   * business instead of a second one (double click, retry after a timeout).
   */
  async create(ownerId: string, draft: BusinessDraft, idempotencyKey: string): Promise<CreatedBusiness> {
    const boss = this.newAssignment(draft.boss.name, draft.boss.email);
    const { business, created } = await this.businesses.insert(
      { ownerId, profile: this.canonicalProfile(draft.profile), boss },
      { key: idempotencyKey, fingerprint: fingerprintOf({ ...draft, boss: { ...draft.boss, email: normalizeEmail(draft.boss.email) } }) },
    );
    // Only a real creation tells the world a boss was assigned; a repeated request must not send a second invitation.
    if (created) await this.announceBoss(business, null);
    return { business, created };
  }

  async list(ownerId: string, query: ListQuery): Promise<{ items: Business[]; total: number }> {
    return this.businesses.list(ownerId, query);
  }

  async get(ownerId: string, id: string): Promise<Business> {
    return this.requireOwned(ownerId, id);
  }

  /**
   * Edits the profile, the modules and the boss, keeping the same id. A different boss email replaces the boss:
   * the previous assignment stops being valid at once. The same email only updates the boss's name.
   */
  async update(ownerId: string, id: string, draft: BusinessDraft): Promise<Business> {
    const current = await this.requireOwned(ownerId, id);
    const email = normalizeEmail(draft.boss.email);
    const replaced = email !== current.boss.email;

    const boss: BossAssignment = replaced
      ? this.newAssignment(draft.boss.name, email)
      : { ...current.boss, name: draft.boss.name.trim() };

    const updated = await this.businesses.updateOwned(ownerId, id, current.version, {
      profile: this.canonicalProfile(draft.profile),
      boss,
      revokedBoss: replaced ? { ...current.boss, revokedAt: this.clock.now() } : null,
    });
    if (!updated) throw new ConcurrentModificationError();

    if (replaced) await this.announceBoss(updated, current.boss.assignmentId);
    return updated;
  }

  pause(ownerId: string, id: string): Promise<Business> {
    return this.changeStatus(ownerId, id, 'paused');
  }

  /** Resuming does not bring back a replaced boss or any expired code: it only lifts the pause. */
  resume(ownerId: string, id: string): Promise<Business> {
    return this.changeStatus(ownerId, id, 'active');
  }

  async exportCsv(ownerId: string, filters: Pick<ListQuery, 'q' | 'category' | 'status'>): Promise<string> {
    const { items } = await this.businesses.list(ownerId, { ...filters, page: 1, pageSize: EXPORT_LIMIT });
    return toCsv(
      CSV_HEADER,
      items.map((business) => [
        business.name,
        business.legalName ?? '',
        business.taxId ?? '',
        business.phone ?? '',
        business.address ?? '',
        business.supportEmail ?? '',
        business.website ?? '',
        business.category === 'other' ? (business.categoryOther ?? 'other') : business.category,
        business.currency,
        business.timezone,
        business.modules.join(' '),
        business.status,
        business.boss.name,
        business.boss.email,
        business.createdAt.toISOString(),
      ]),
    );
  }

  private async changeStatus(ownerId: string, id: string, status: BusinessStatus): Promise<Business> {
    const business = await this.businesses.setStatus(ownerId, id, status);
    if (!business) throw new BusinessNotFoundError();
    return business;
  }

  private async requireOwned(ownerId: string, id: string): Promise<Business> {
    const business = await this.businesses.findOwned(ownerId, id);
    if (!business) throw new BusinessNotFoundError();
    return business;
  }

  private newAssignment(name: string, email: string): BossAssignment {
    return { assignmentId: randomUUID(), name: name.trim(), email: normalizeEmail(email), assignedAt: this.clock.now() };
  }

  /** "Other" is the only category that keeps its own text. */
  private canonicalProfile(profile: BusinessProfile): BusinessProfile {
    return { ...profile, categoryOther: profile.category === 'other' ? profile.categoryOther : null };
  }

  private announceBoss(business: Business, replacedAssignmentId: string | null): Promise<void> {
    return this.events.publish(
      new BossAssigned(business.id, business.name, business.ownerId, business.boss.assignmentId, business.boss.name, business.boss.email, replacedAssignmentId),
    );
  }
}
