import { Link, NavLink } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { PROFILE_PATH, WORKSPACE_PATH } from "../paths";

/** Workspace sidebar: brand, space name, navigation and a decorative footer. Hidden on narrow screens. */
export function WorkspaceSidebar({ businessCount }: { businessCount: number | null }) {
  return (
    <aside className="ws-sidebar" aria-label="Navegación del workspace">
      <Link className="ws-brand" to={WORKSPACE_PATH} aria-label="Necto, inicio del workspace">
        <NectoLogo width={161} height={23} />
      </Link>

      <div className="ws-space-label">
        <span className="ws-space-icon" aria-hidden="true">
          <NectoLogo variant="mark" width={64} height={64} />
        </span>
        <div>
          <strong>Mi workspace</strong>
          <span>Tu espacio en Necto</span>
        </div>
      </div>

      <nav className="ws-nav" aria-label="Menú principal">
        <p>GENERAL</p>
        <NavLink to={WORKSPACE_PATH} end className={({ isActive }) => (isActive ? "is-active" : undefined)}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 10v10h16V10M3 4h18l1 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1l1-6Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M10 20v-6h5v6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Negocios</span>
          {businessCount !== null && <b>{businessCount}</b>}
        </NavLink>

        <p className="ws-nav-account-label">CUENTA</p>
        <NavLink to={PROFILE_PATH} className={({ isActive }) => (isActive ? "is-active" : undefined)}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5 21v-2a7 7 0 0 1 14 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>Mi perfil</span>
        </NavLink>
      </nav>

      <div className="ws-sidebar-bottom">
        <div className="ws-sidebar-motif" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
        <p>
          Todo empieza con
          <br />
          una buena conexión.
        </p>
        <span>Necto · Grow together</span>
      </div>
    </aside>
  );
}
