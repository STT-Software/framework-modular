/** What the general dashboard of a business shows of Turnos. All of it is counted from real data. */
export interface TurnosDashboardSummary {
  queues: { total: number; paused: number };
  operators: { total: number; active: number; pending: number; inactive: number };
  /** The business's own day, in its time zone. */
  today: {
    created: number;
    waiting: number;
    attending: number;
    completed: number;
    cancelled: number;
    noShow: number;
    /** Null when no turn was called today: there is nothing to average. */
    averageWaitMinutes: number | null;
    averageServiceMinutes: number | null;
  };
  /** Satisfaction of the last 30 days; null average without answers. */
  satisfaction: { average: number | null; responses: number };
}
/**
 * Public contract of Turnos for the general dashboard of a business: the real indicators of the module, or null when the business has no
 * Turnos (or it is not active). The dashboard never reads the tables of Turnos.
 */
export abstract class TurnosDashboard {
  abstract summaryOf(businessId: string): Promise<TurnosDashboardSummary | null>;
}
