import { Button } from "@/elements/ui/button";
import { superAdminSessionStore } from "@/modules/super-admin-auth";

/**
 * Cierra la sesión del superadmin. Al borrar la sesión, la puerta RequireSuperAdmin
 * detecta el cambio y lleva sola al login.
 */
export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="md"
      onClick={() => superAdminSessionStore.signOut()}
      startIcon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      Cerrar sesión
    </Button>
  );
}
