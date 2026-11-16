import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Link, NavLink, useLocation } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import {
  BaseAppSidebar,
  MenuItem,
  MenuSectionHeader,
  useSidebarContext,
} from "@/shell";
import { uiStore } from "@/stores";
import { cn } from "@/utils";
import { NEW_BUSINESS_PATH, PROFILE_PATH, WORKSPACE_PATH } from "../paths";

export interface WorkspaceSidebarProps {
  businessCount: number | null;
}

const StoreIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 10v10h16V10M3 4h18l1 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1l1-6Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M10 20v-6h5v6" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const PlusSquareIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const UserOutlineIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M5 20.5v-1.5a7 7 0 0 1 14 0v1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const SignOutIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RAIL_TOOLTIP_CLASSES =
  "hidden xl:flex pointer-events-none absolute left-[52px] items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200/90 bg-white/95 dark:bg-gray-900/95 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white shadow-theme-md backdrop-blur-md opacity-0 -translate-x-1 transition-all duration-150 group-hover/rail:opacity-100 group-hover/rail:translate-x-0 group-focus-visible/rail:opacity-100 group-focus-visible/rail:translate-x-0 z-50";

/** Workspace sidebar built on BaseAppSidebar: floating card when expanded, centered clickable rail pill when collapsed. */
export const WorkspaceSidebar = observer(({ businessCount }: WorkspaceSidebarProps) => {
  return (
    <BaseAppSidebar
      logo={
        <Link
          className="ws-brand flex items-center"
          to={WORKSPACE_PATH}
          onClick={() => uiStore.closeMobileSidebar()}
          title="NECTO · Workspace"
          aria-label="Necto, inicio del workspace"
        >
          <NectoLogo width={144} height={21} />
        </Link>
      }
      logoCollapsed={
        <Link
          to={WORKSPACE_PATH}
          title="NECTO"
          aria-label="Inicio NECTO"
          className="group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-gray-100/70 dark:hover:bg-white/5"
        >
          <NectoLogo variant="mark" width={20} height={20} />
        </Link>
      }
    >
      <WorkspaceSidebarContent businessCount={businessCount} />
    </BaseAppSidebar>
  );
});

const WorkspaceSidebarContent = observer(({ businessCount }: WorkspaceSidebarProps) => {
  const { pathname } = useLocation();
  const { isExpanded } = useSidebarContext();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("ws_sidebar_sections");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("ws_sidebar_sections", JSON.stringify(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const isBusinessesActive =
    pathname === WORKSPACE_PATH ||
    (pathname.startsWith("/workspace/businesses/") && pathname !== NEW_BUSINESS_PATH);
  const isNewBusinessActive = pathname === NEW_BUSINESS_PATH;
  const isProfileActive = pathname === PROFILE_PATH;

  const railButtonClass = (active: boolean) =>
    cn(
      "group/rail relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer",
      active
        ? "text-brand-500 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-400 scale-105"
        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5"
    );

  if (!isExpanded) {
    return (
      <nav className="flex flex-col items-center justify-center gap-2 w-full py-1" aria-label="Menú rápido del workspace">
        <NavLink
          to={WORKSPACE_PATH}
          end
          aria-label={businessCount !== null ? `Negocios (${businessCount})` : "Negocios"}
          className={() => railButtonClass(isBusinessesActive)}
        >
          <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover/rail:scale-110">
            <StoreIcon className="h-5 w-5" />
          </span>
          {businessCount !== null && businessCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3F1A] shadow-[0_0_8px_#FF3F1A] ring-1.5 ring-white dark:ring-gray-900" />
            </span>
          )}
          <span className={RAIL_TOOLTIP_CLASSES}>
            <span>Negocios</span>
            {businessCount !== null && (
              <span className="rounded-md bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                {businessCount}
              </span>
            )}
          </span>
        </NavLink>

        <NavLink
          to={NEW_BUSINESS_PATH}
          aria-label="Crear negocio"
          className={() => railButtonClass(isNewBusinessActive)}
        >
          <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover/rail:scale-110">
            <PlusSquareIcon className="h-5 w-5" />
          </span>
          <span className={RAIL_TOOLTIP_CLASSES}>Crear negocio</span>
        </NavLink>

        <NavLink
          to={PROFILE_PATH}
          aria-label="Mi perfil"
          className={() => railButtonClass(isProfileActive)}
        >
          <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover/rail:scale-110">
            <UserOutlineIcon className="h-5 w-5" />
          </span>
          <span className={RAIL_TOOLTIP_CLASSES}>Mi perfil</span>
        </NavLink>

        <div className="w-full border-t border-gray-200/70 dark:border-white/5 mt-1 pt-2 flex flex-col items-center">
          <button
            type="button"
            onClick={() => superAdminSessionStore.signOut()}
            aria-label="Cerrar sesión"
            className="group/rail relative flex items-center justify-center w-10 h-10 rounded-full text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover/rail:scale-110">
              <SignOutIcon className="h-5 w-5" />
            </span>
            <span className={RAIL_TOOLTIP_CLASSES}>Cerrar sesión</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex flex-col flex-1" aria-label="Menú principal del workspace">
      {/* Space card matching StockFlow elevated surface */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white dark:border-white/10 dark:bg-gray-800"
          aria-hidden="true"
        >
          <NectoLogo variant="mark" width={18} height={18} />
        </span>
        <div className="min-w-0">
          <strong className="block truncate text-sm font-semibold text-gray-900 dark:text-white leading-tight">
            Mi workspace
          </strong>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Tu espacio en Necto
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <MenuSectionHeader
            title="General"
            collapsible
            isCollapsed={Boolean(collapsedSections.general)}
            onToggle={() => toggleSection("general")}
          />
          <div
            className={`transition-all duration-200 ease-in-out overflow-hidden ${
              collapsedSections.general ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
            }`}
          >
            <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
              <MenuItem
                icon={<StoreIcon />}
                name="Negocios"
                path={WORKSPACE_PATH}
                isActive={() => isBusinessesActive}
                cuenta={businessCount}
              />
              <MenuItem
                icon={<PlusSquareIcon />}
                name="Crear negocio"
                path={NEW_BUSINESS_PATH}
                isActive={() => isNewBusinessActive}
              />
            </ul>
          </div>
        </div>

        <div>
          <MenuSectionHeader
            title="Cuenta"
            collapsible
            isCollapsed={Boolean(collapsedSections.cuenta)}
            onToggle={() => toggleSection("cuenta")}
          />
          <div
            className={`transition-all duration-200 ease-in-out overflow-hidden ${
              collapsedSections.cuenta ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
            }`}
          >
            <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
              <MenuItem
                icon={<UserOutlineIcon />}
                name="Mi perfil"
                path={PROFILE_PATH}
                isActive={() => isProfileActive}
              />
            </ul>
          </div>
        </div>
      </div>

      {/* Footer pinned at bottom */}
      <div className="mt-auto border-t border-gray-200/70 dark:border-white/5 pt-3 pb-5">
        <button
          type="button"
          onClick={() => superAdminSessionStore.signOut()}
          className="menu-item group text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 cursor-pointer"
        >
          <span className="menu-item-icon-size text-error-700 dark:text-error-400">
            <SignOutIcon />
          </span>
          <span>Cerrar sesión</span>
        </button>
        <p className="px-3 pt-3 text-[11px] text-gray-400 dark:text-gray-500">
          Necto · Grow together
        </p>
      </div>
    </nav>
  );
});

export default WorkspaceSidebar;
