/**
 * Dynamic imports of the onboarding pages, shared by the routes (`React.lazy`) and the preloads of the next step, so
 * both use the same chunk. Lives apart from `index.ts` so pages can preload without importing the module's public gate.
 */
export const loadOnboardingPage = () => import("./OnboardingPage");
export const loadPhoneStepPage = () => import("./PhoneStepPage");
export const loadSourceStepPage = () => import("./SourceStepPage");
export const loadReadyPage = () => import("./ReadyPage");

/** Preloads ignore failures: the route's own lazy load retries and shows its error if needed. */
export function preloadSourceStepPage(): void {
  void loadSourceStepPage().catch(() => undefined);
}

export function preloadReadyPage(): void {
  void loadReadyPage().catch(() => undefined);
}
