import { observer } from "mobx-react-lite";
import { Navigate, Outlet } from "react-router";
import { superAdminSessionStore } from "@/modules/super-admin-auth";

/**
 * Puerta de acceso: las rutas que envuelve solo se ven con una sesión de superadmin.
 * Sin sesión, manda al login. Por ahora es la única forma de entrar a la app.
 */
export const RequireSuperAdmin = observer(() => {
  if (!superAdminSessionStore.isAuthenticated) {
    return <Navigate to="/super/login" replace />;
  }
  return <Outlet />;
});
