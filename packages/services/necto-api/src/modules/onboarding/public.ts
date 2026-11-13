/**
 * Public door of the onboarding module: the only file other code may import from it.
 *
 * Today it exposes just the module, so the application can register it. No other module needs
 * anything from onboarding yet. When one does (for example, to know whether a user completed
 * their profile), add the contract here (an exported use case or interface), never the
 * repository or the schema of `onboarding_profiles`.
 */
export { OnboardingModule } from './onboarding.module';
