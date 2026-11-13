/**
 * Public door of the auth module: the only file other code may import from it.
 *
 * Today it exposes just the module, so the application can register it. No other module needs
 * anything from auth: the identity of the user comes from `platform/security`, not from here.
 * When a module does need something that auth owns (for example, the profile of a super admin),
 * add the contract here (an exported use case or interface), never its repository or its schema.
 */
export { AuthModule } from './auth.module';
