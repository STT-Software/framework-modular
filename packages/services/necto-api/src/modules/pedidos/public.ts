/**
 * Public door of the pedidos module: the only file other code may import from it.
 *
 * - `PedidosModule`: so `AppModule` can register the capability.
 * - `PEDIDOS_MODULE_ID` / `PEDIDOS_PROFILE_IDS` / `PedidosProfileId`: stable identifiers.
 *
 * Never expose repositories, schemas, controllers, or internal operations here.
 */
export { PedidosModule } from './pedidos.module';
export { PEDIDOS_MODULE_ID, PEDIDOS_PROFILE_IDS, type PedidosProfileId } from './domain/catalog';
