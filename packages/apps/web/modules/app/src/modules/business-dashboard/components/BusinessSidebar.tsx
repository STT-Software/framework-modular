import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Link, NavLink } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { PanelToggleIcon } from "@/icons";
import { BaseAppSidebar, MenuItem, MenuSectionHeader, useSidebarContext } from "@/shell";
import { uiStore } from "@/stores";
import { cn } from "@/utils";
import type { IconName } from "./icons";
import { ICONS } from "./icons";
import { initials } from "./ui";
export interface SidebarItem {
  to: string;
  label: string;
  icon: IconName;
  current?: boolean;
  count?: number;
}
export interface BusinessSidebarProps {
  businessName: string;
  /** «Espacio de trabajo» en el dashboard general, «Módulo de Turnos» dentro de Turnos. */
  businessSubtitle: string;
  /** Título de la sección de navegación («MI NEGOCIO», «TURNOS»). */
  navTitle: string;
  items: SidebarItem[];
  /** Un enlace suelto sobre la navegación (en Turnos, el administrador vuelve a «Mi negocio»). */
  homeLink?: { to: string; label: string };
  /** A dónde lleva el logotipo. */
  logoTo: string;
  /** Enlaces de la sección «Cuenta» (el administrador tiene «Configuración»). */
  accountItems?: SidebarItem[];
  onSignOut: () => void;
}
/** Un icono de la referencia con el trazo de la barra lateral (los iconos del módulo son solo trazos). */
export function NavIcon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
const RAIL_TOOLTIP_CLASSES =
  "hidden xl:flex pointer-events-none absolute left-[52px] items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200/90 bg-white/95 dark:bg-gray-900/95 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white shadow-theme-md backdrop-blur-md opacity-0 -translate-x-1 transition-all duration-150 group-hover/rail:opacity-100 group-hover/rail:translate-x-0 group-focus-visible/rail:opacity-100 group-focus-visible/rail:translate-x-0 z-50";
/** La N de Necto en un círculo; con la barra contraída ocupa la esquina superior izquierda (`collapsedSlot` de `ToggleAppSidebar`). */
export function BusinessRailMark({ to }: { to: string }) {
  return (
    <Link
      to={to}
      aria-label="Necto, inicio"
      title="Inicio"
      className="flex items-center justify-center w-11 h-11 rounded-full border border-gray-200/80 bg-white shadow-theme-xs transition-transform duration-200 hover:scale-105 active:scale-95 dark:border-transparent dark:bg-[#190088] dark:shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)] dark:[&_path[fill='#190088']]:fill-white"
    >
      <NectoLogo variant="mark" width={20} height={20} />
    </Link>
  );
}
const SignOutIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
/**
 * La barra lateral del administrador y del operador: la misma del superadministrador (`BaseAppSidebar`), con su tarjeta flotante al estar
 * expandida y su riel de iconos al contraerse. Lo que cambia es el contenido: el negocio, la navegación según las vistas de la persona y
 * su cuenta.
 */
export const BusinessSidebar = observer((props: BusinessSidebarProps) => (
  <BaseAppSidebar
    logo={
      <Link className="flex items-center" to={props.logoTo} onClick={() => uiStore.closeMobileSidebar()} title="NECTO" aria-label="Necto, inicio">
        <NectoLogo width={144} height={21} />
      </Link>
    }
    bareRail
  >
    <BusinessSidebarContent {...props} />
  </BaseAppSidebar>
));
const BusinessSidebarContent = observer(({ businessName, businessSubtitle, navTitle, items, homeLink, accountItems = [], onSignOut }: BusinessSidebarProps) => {
  const { isExpanded } = useSidebarContext();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("biz_sidebar_sections");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const toggleSection = (id: string) =>
    setCollapsedSections((previous) => {
      const next = { ...previous, [id]: !previous[id] };
      try {
        localStorage.setItem("biz_sidebar_sections", JSON.stringify(next));
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      return next;
    });
  const all = homeLink ? [{ to: homeLink.to, label: homeLink.label, icon: "building" as IconName, current: false }, ...items] : items;
  // Dentro de una píldora: iconos planos; la sección actual lleva un círculo suave.
  const railButtonClass = (active: boolean) =>
    cn(
      "group/rail relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ease-out hover:scale-105 active:scale-95 cursor-pointer",
      active ? "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
    );
  const railPillClass = "flex flex-col items-center gap-2 rounded-full border border-gray-200/80 bg-white p-1.5 shadow-theme-xs dark:border-white/10 dark:bg-gray-900";
  if (!isExpanded) {
    return (
      <nav className="flex h-full flex-col items-center w-full" aria-label="Menú rápido">
        <div className={cn(railPillClass, "my-auto")}>
          <button
            type="button"
            onClick={() => uiStore.toggleSidebar()}
            aria-label="Expandir barra lateral"
            className="group/rail relative flex items-center justify-center w-10 h-10 rounded-full bg-[#ff3f1a] text-white shadow-[0_6px_14px_-6px_rgba(255,63,26,0.6)] hover:bg-[#e5351a] dark:bg-[#190088] dark:shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)] dark:hover:bg-[#17016c] transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <PanelToggleIcon filled={false} size={18} />
            <span className={RAIL_TOOLTIP_CLASSES}>Expandir menú</span>
          </button>
          {all.map((item) => (
            <NavLink key={item.to} to={item.to} end aria-label={item.label} className={() => railButtonClass(Boolean(item.current))}>
              <NavIcon name={item.icon} />
              <span className={RAIL_TOOLTIP_CLASSES}>
                <span>{item.label}</span>
                {item.count !== undefined ? (
                  <span className="rounded-md bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{item.count}</span>
                ) : null}
              </span>
            </NavLink>
          ))}
        </div>
        <div className={railPillClass}>
          {accountItems.map((item) => (
            <NavLink key={item.to} to={item.to} aria-label={item.label} className={() => railButtonClass(Boolean(item.current))}>
              <NavIcon name={item.icon} />
              <span className={RAIL_TOOLTIP_CLASSES}>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Cerrar sesión"
            className="group/rail relative flex items-center justify-center w-10 h-10 rounded-full text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <SignOutIcon className="h-5 w-5" />
            <span className={RAIL_TOOLTIP_CLASSES}>Cerrar sesión</span>
          </button>
        </div>
      </nav>
    );
  }
  return (
    <nav className="flex flex-col flex-1" aria-label="Menú principal">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-gray-800 dark:text-gray-200" aria-hidden="true">
          {initials(businessName)}
        </span>
        <div className="min-w-0">
          <strong className="block truncate text-sm font-semibold text-gray-900 dark:text-white leading-tight">{businessName}</strong>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">{businessSubtitle}</span>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div>
          <MenuSectionHeader title={navTitle} collapsible isCollapsed={Boolean(collapsedSections.nav)} onToggle={() => toggleSection("nav")} />
          <div className={`transition-all duration-200 ease-in-out overflow-hidden ${collapsedSections.nav ? "max-h-0 opacity-0" : "max-h-[34rem] opacity-100"}`}>
            <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
              {all.map((item) => (
                <MenuItem key={item.to} icon={<NavIcon name={item.icon} />} name={item.label} path={item.to} isActive={() => Boolean(item.current)} cuenta={item.count} />
              ))}
            </ul>
          </div>
        </div>
        {accountItems.length > 0 ? (
          <div>
            <MenuSectionHeader title="Cuenta" collapsible isCollapsed={Boolean(collapsedSections.account)} onToggle={() => toggleSection("account")} />
            <div className={`transition-all duration-200 ease-in-out overflow-hidden ${collapsedSections.account ? "max-h-0 opacity-0" : "max-h-96 opacity-100"}`}>
              <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
                {accountItems.map((item) => (
                  <MenuItem key={item.to} icon={<NavIcon name={item.icon} />} name={item.label} path={item.to} isActive={() => Boolean(item.current)} />
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-auto pt-6 pb-5">
        <p className="px-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Todo empieza con
          <br />
          una buena conexión.
        </p>
        <div className="mt-4 border-t border-gray-200/70 dark:border-white/5 pt-3">
          <button type="button" onClick={onSignOut} className="menu-item group text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 cursor-pointer">
            <span className="menu-item-icon-size text-error-700 dark:text-error-400">
              <SignOutIcon />
            </span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </nav>
  );
});
