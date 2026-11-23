import { observer } from "mobx-react-lite";
import { adminAccessStore } from "@/modules/business-access/stores/adminAccess.store";
import { superAdminSessionStore } from "@/modules/super-admin-auth";

interface RoleShieldBadgeProps {
  role?: "Administrador" | "Operador" | "Superadministrador" | string;
  className?: string;
}

/**
 * Role badge matching WorkspaceTopbar's shield indicator,
 * dynamically reflecting the active role (Administrador, Operador, etc.).
 */
export const RoleShieldBadge = observer(({ role, className = "" }: RoleShieldBadgeProps) => {
  const resolvedRole =
    role ??
    (adminAccessStore.access?.role === "operator"
      ? "Operador"
      : superAdminSessionStore.isAuthenticated && !adminAccessStore.access
      ? "Superadministrador"
      : "Administrador");

  return (
    <span
      className={`config-role-badge ${className}`.trim()}
      title={`Rol activo: ${resolvedRole}`}
      aria-label={`Rol activo: ${resolvedRole}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="config-role-shield-icon"
      >
        <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{resolvedRole}</span>
    </span>
  );
});

export default RoleShieldBadge;
