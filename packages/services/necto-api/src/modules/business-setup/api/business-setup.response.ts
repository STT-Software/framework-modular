import type { SetupState } from '../application/business-setup.service';

/**
 * What the API shows of the setup of a business. Dates are ISO strings. The logo is never inlined (it can weigh 1 MB):
 * `logo.url` is where to download it, with the same session.
 */
export function toSetupResponse(state: SetupState) {
  const { business } = state;
  return {
    business: { id: business.id, status: business.status, currency: business.currency, timezone: business.timezone },
    modules: state.modules.map(moduleResponse),
    profile: {
      name: business.name,
      legalName: business.legalName,
      taxId: business.taxId,
      phone: business.phone,
      supportEmail: business.supportEmail,
      address: business.address,
      website: business.website,
      description: state.description,
    },
    category: { id: business.category, other: business.categoryOther },
    /** Only for a business that has Turnos: the attention profile that suggests its first queues. */
    turnos: state.turnos
      ? {
          profile: state.turnos.profile,
          suggested: state.turnos.suggested,
          profiles: state.turnos.options.map((option) => ({
            id: option.id,
            name: option.name,
            description: option.description,
            suggestedQueues: option.suggestedQueues.map((queue) => queue.name),
          })),
        }
      : null,
    logo: state.logo
      ? {
          contentType: state.logo.contentType,
          sizeBytes: state.logo.sizeBytes,
          updatedAt: state.logo.updatedAt.toISOString(),
          url: `/business-setup/businesses/${business.id}/logo`,
        }
      : null,
    schedule: {
      timezone: state.timezone,
      base: { days: state.baseSchedule, saved: state.baseScheduleSaved, openNow: state.baseOpenNow },
      modules: Object.fromEntries(
        state.modules.map((module) => [
          module.id,
          { inherit: module.inherit, days: module.effectiveSchedule, ownDays: module.ownSchedule, openNow: module.openNow },
        ]),
      ),
    },
    progress: {
      currentStep: state.progress.currentStep,
      visitedSteps: state.progress.visitedSteps,
      baseReady: state.progress.baseReady,
      baseReadyAt: state.progress.baseReadyAt?.toISOString() ?? null,
    },
  };
}

function moduleResponse(module: SetupState['modules'][number]) {
  return {
    id: module.id,
    name: module.name,
    description: module.description,
    schedule: { mode: module.inherit ? 'inherited' : 'custom' },
    // The settings of each module are configured in the module itself: pending until it says it is ready.
    settings: { status: module.settings.status, ...(module.settings.summary ? { summary: module.settings.summary } : {}) },
  };
}

/** The assigned modules and whether the base is ready: what the first screen of the setup shows. */
export function toModulesResponse(state: SetupState) {
  return { baseReady: state.progress.baseReady, modules: state.modules.map(moduleResponse) };
}
