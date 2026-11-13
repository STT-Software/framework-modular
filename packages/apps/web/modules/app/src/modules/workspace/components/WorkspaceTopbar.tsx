import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { ThemeIconButton } from "@/shell";
import { initialsOf } from "../initials";
import { PROFILE_PATH, WORKSPACE_PATH } from "../paths";

/** Top bar: location, role, theme, sign out and the way into the profile. `section` is the current screen. */
export const WorkspaceTopbar = observer(({ section }: { section: string }) => {
  const initials = initialsOf(superAdminSessionStore.superAdmin?.username);
  return (
    <header className="ws-topbar">
      <Link className="ws-mobile-brand" to={WORKSPACE_PATH} aria-label="Necto, inicio del workspace">
        <NectoLogo width={161} height={23} />
      </Link>

      <nav className="ws-breadcrumb" aria-label="Ubicación">
        <span>Mi workspace</span>
        <span aria-hidden="true">/</span>
        <strong>{section}</strong>
      </nav>

      <div className="ws-topbar-actions">
        <span className="ws-role">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.6" />
            <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Superadministrador
        </span>
        <ThemeIconButton className="ws-icon-button" />
        {/* Not in the reference: the workspace does not use AppShell, so without this button there would be no way to sign out. */}
        <button
          type="button"
          className="ws-icon-button"
          onClick={() => superAdminSessionStore.signOut()}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <Link
          className="ws-avatar"
          to={PROFILE_PATH}
          aria-label="Ver mi perfil de superadministrador"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
});
