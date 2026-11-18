/**
 * The four steps of the base configuration, in order: business data, schedules, type of business and review.
 * They only say where the person is; the server does not force the order (every write is validated on its own).
 */
export const SETUP_STEPS = ['data', 'schedule', 'category', 'review'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
