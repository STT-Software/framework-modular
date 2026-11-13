import type { ComponentType } from "react";

/** Una ruta que un módulo ofrece a la app. */
export interface ModuleRoute {
  path?: string;
  /** Ruta índice (se muestra cuando la URL coincide exactamente con la del padre). */
  index?: boolean;
  /** Componente de la ruta. Debe cargarse con React.lazy para no entrar al bundle inicial. */
  component?: ComponentType;
  /** En lugar de un componente, redirige a esta ruta relativa. */
  redirectTo?: string;
  children?: ModuleRoute[];
}

/** Lo que un módulo expone a la app: su identificador y sus rutas. */
export interface AppModule {
  id: string;
  /** Si es true, la app pone sus rutas detrás de la puerta de acceso (`RequireSuperAdmin`). */
  requiresSuperAdmin?: boolean;
  routes: ModuleRoute[];
}
