import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../platform/events/event-bus';
import { BossAssigned } from '../businesses/public';
import { InvitationService } from './application/invitation.service';

/** Connects this module to what the businesses module announces: a boss was assigned, so they get their access. */
@Injectable()
export class BusinessEventsSubscriber implements OnModuleInit {
  constructor(
    private readonly events: EventBus,
    private readonly invitations: InvitationService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(BossAssigned, (event) => this.invitations.onBossAssigned(event));
  }
}
