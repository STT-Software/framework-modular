import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { BusinessDirectory } from '../../businesses/public';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { totalsOf } from '../domain/metrics';
import { resolveRange } from '../domain/range';
import { analyzeSurveys } from '../domain/survey';
import { SurveyRepository } from '../domain/survey.repository';
import { TicketRepository } from '../domain/ticket.repository';
import { TurnosDashboard, type TurnosDashboardSummary } from '../domain/turnos-dashboard';
import { FALLBACK_TIMEZONE } from './turnos-access.service';
import { TurnosConfigurationStore } from './turnos-configuration.store';
@Injectable()
export class TurnosDashboardService extends TurnosDashboard {
  constructor(
    private readonly store: TurnosConfigurationStore,
    private readonly tickets: TicketRepository,
    private readonly surveys: SurveyRepository,
    private readonly directory: BusinessDirectory,
    private readonly clock: Clock,
  ) {
    super();
  }
  async summaryOf(businessId: string): Promise<TurnosDashboardSummary | null> {
    const business = await this.directory.find(businessId);
    if (!business || business.status !== 'active' || !business.modules.includes(TURNOS_MODULE_ID)) return null;
    const timezone = business.timezone ?? FALLBACK_TIMEZONE;
    const now = this.clock.now();
    const today = resolveRange({ preset: 'today' }, now, timezone);
    const month = resolveRange({ preset: '30d' }, now, timezone);
    const [config, rows, counts, invitations] = await Promise.all([
      this.store.find(businessId),
      this.tickets.inRange(businessId, null, today.from, today.to, 20000),
      this.tickets.openCounts(businessId, null),
      this.surveys.inRange(businessId, { queueIds: null }, month.from, month.to, 20000),
    ]);
    const totals = totalsOf(rows);
    const open = [...counts.values()].reduce((sum, count) => ({ waiting: sum.waiting + count.waiting, attending: sum.attending + count.attending }), { waiting: 0, attending: 0 });
    const operators = config?.operators ?? [];
    const satisfaction = analyzeSurveys(invitations, month, timezone, [], { all: true, operatorId: null }).overall;
    return {
      queues: { total: config?.queues.length ?? 0, paused: config?.queues.filter((queue) => queue.status === 'paused').length ?? 0 },
      operators: {
        total: operators.length,
        active: operators.filter((operator) => operator.status === 'active').length,
        pending: operators.filter((operator) => operator.status === 'pending').length,
        inactive: operators.filter((operator) => operator.status === 'inactive').length,
      },
      today: {
        created: totals.created,
        waiting: open.waiting,
        attending: open.attending,
        completed: totals.completed,
        cancelled: totals.cancelled,
        noShow: totals.noShow,
        averageWaitMinutes: totals.averageWaitMinutes,
        averageServiceMinutes: totals.averageServiceMinutes,
      },
      satisfaction: { average: satisfaction.average, responses: satisfaction.responses },
    };
  }
}
