import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link, NavLink, useLocation } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import {
  CartIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  AlertHexaIcon,
  TruckDelivery,
  TableIcon,
  PieChartIcon,
  GroupIcon,
  InfoIcon,
  ArrowRightIcon,
  PanelToggleIcon,
} from "@/icons";
import { Cog6ToothIcon, HomeIcon } from "@heroicons/react/24/outline";
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
  businessId?: string;
  businessName: string;
  /** «Espacio de trabajo» en el dashboard general, «Módulo de Turnos» dentro de Turnos. */
  businessSubtitle: string;
  /** Título de la sección de navegación («MI NEGOCIO», «PEDIDOS», «TURNOS»). */
  navTitle: string;
  items: SidebarItem[];
  /** Un enlace suelto sobre la navegación (en Turnos o Pedidos, vuelve a «Mi negocio»). */
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

/** La N de Necto en un círculo; retrocompatibilidad por si se referencia en otras vistas. */
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

/**
 * Isotipo geométrico N oficial de NECTO con el diseño y tamaño idéntico a StockFlow
 * en modo contraído (rail pill).
 */
export const BusinessLogoCollapsed = observer(({ to }: { to: string }) => {
  return (
    <Link
      to={to}
      title="NECTO"
      aria-label="Inicio NECTO"
      className="group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-gray-100/70 dark:hover:bg-white/5"
    >
      <svg
        className="size-5 transition-transform duration-200 group-hover:scale-105 select-none"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22.4171 19.1921L19.5245 22.1622C18.9564 22.7461 18.0008 22.7715 17.4068 22.1622L9.16827 14.064C8.23853 13.1501 6.63731 13.7848 6.63731 15.1049V21.0453C6.63731 21.8576 5.96583 22.4923 5.16522 22.4923H1.47209C0.645653 22.4923 0 21.8322 0 21.0453V5.3819C0 5.0011 0.154957 4.62031 0.439044 4.34106L3.43487 1.39625C4.00305 0.837748 4.90696 0.837748 5.50096 1.37086L22.3654 17.1104C22.9594 17.6689 22.9852 18.5828 22.4171 19.1667V19.1921Z"
          fill="#FF3F1A"
        />
        <path
          d="M22.8045 1.92936V4.29029C22.8045 5.12803 22.0555 5.83885 21.1258 5.83885H15.3149C13.8428 5.83885 13.0938 4.21413 14.1269 3.22406L16.6062 0.863135C16.9161 0.558499 17.3551 0.406181 17.7942 0.406181H21.1258C22.0555 0.406181 22.8045 1.09161 22.8045 1.95475V1.92936Z"
          className="fill-[#190088] dark:fill-white"
        />
      </svg>
    </Link>
  );
});

const ORDERS_WATERMARK = (
  <svg viewBox="0 0 100 80" fill="none" className="w-24 h-20 opacity-25 dark:opacity-10 stroke-current text-gray-400 dark:text-white">
    <path d="M10 70 L50 20 L90 50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="50" cy="20" r="8" strokeWidth="2" />
    <circle cx="90" cy="50" r="5" strokeWidth="2" />
  </svg>
);

/**
 * La barra lateral de la aplicación (administrador y operador):
 * - Expandida: tarjeta flotante completa con las secciones de navegación.
 * - Contraída (rail): píldora centrada verticalmente estilo StockFlow, con opciones de módulo
 *   recogidas en un icono y flyout lateral animado al hacer clic.
 */
export const BusinessSidebar = observer((props: BusinessSidebarProps) => (
  <BaseAppSidebar
    logo={
      <Link className="flex items-center" to={props.logoTo} onClick={() => uiStore.closeMobileSidebar()} title="NECTO" aria-label="Necto, inicio">
        <NectoLogo width={144} height={21} />
      </Link>
    }
    logoCollapsed={<BusinessLogoCollapsed to={props.logoTo} />}
  >
    <BusinessSidebarContent {...props} />
  </BaseAppSidebar>
));

const BusinessSidebarContent = observer((props: BusinessSidebarProps) => {
  const { businessId, businessName, businessSubtitle, navTitle, items, homeLink, logoTo, accountItems = [], onSignOut } = props;
  const { isExpanded } = useSidebarContext();
  const { pathname } = useLocation();

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

  // Extraer businessId de la ruta si no se pasó directamente
  const resolvedBusinessId = businessId || (() => {
    const match = pathname.match(/\/business\/(?:app|pedidos|turnos)\/([^/]+)/);
    return match ? match[1] : "";
  })();

  const basePedidos = `/business/app/${resolvedBusinessId}/pedidos`;

  // Las 7 opciones canónicas del flyout de Pedidos (StockFlow)
  const ordersFlyoutItems = [
    { id: "inicio", label: "Dashboard", path: `${basePedidos}/dashboard`, Icono: GridIcon },
    { id: "tablero", label: "Gestión de pedidos", path: `${basePedidos}/orders`, Icono: ListIcon },
    { id: "novedades", label: "Gestión de novedades", path: `${basePedidos}/incidents`, Icono: AlertHexaIcon },
    { id: "transportadoras", label: "Transportadoras", path: `${basePedidos}/carriers`, Icono: TruckDelivery },
    { id: "catalogo", label: "Catálogo", path: `${basePedidos}/catalog`, Icono: TableIcon },
    { id: "analitica", label: "Analítica", path: `${basePedidos}/analytics`, Icono: PieChartIcon },
    { id: "operadores", label: "Operadores", path: `${basePedidos}/operators`, Icono: GroupIcon },
  ];

  const [flyoutModulo, setFlyoutModulo] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Cerrar flyout al cambiar de ruta, al expandir la barra, o con Escape
  useEffect(() => {
    setFlyoutModulo(null);
  }, [pathname, isExpanded]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyoutModulo(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cerrar flyout al hacer click en cualquier parte fuera del submenú
  useEffect(() => {
    if (!flyoutModulo) return;
    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        railRef.current &&
        !railRef.current.contains(target)
      ) {
        setFlyoutModulo(null);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [flyoutModulo]);

  const all = homeLink ? [{ to: homeLink.to, label: homeLink.label, icon: "building" as IconName, current: false }, ...items] : items;

  // En modo contraído (rail)
  if (!isExpanded) {
    const isPedidosActive = pathname.includes("/pedidos");
    const isHomeActive = isPedidosActive
      ? pathname === `${basePedidos}/dashboard` || pathname === basePedidos || pathname === `${basePedidos}/`
      : pathname === homeLink?.to || pathname === `/business/app/${resolvedBusinessId}` || pathname === `/business/app/${resolvedBusinessId}/modules`;
    const settingsItem = accountItems[0] || null;
    const isSettingsActive = settingsItem ? pathname.startsWith(settingsItem.to) : false;
    const isPedidosFlyoutOpen = flyoutModulo === "pedidos";

    // El botón del módulo aparece en todo el espacio del negocio (Pedidos, Turnos o la pantalla general)
    const isPedidosModule = navTitle === "PEDIDOS" || isPedidosActive || Boolean(resolvedBusinessId);

    return (
      <nav className="flex flex-col flex-initial" aria-label="Menú rápido">
        {/* FLYOUT SUBMENU PANEL (Flotante a la derecha del rail contraído estilo StockFlow) */}
        {isPedidosFlyoutOpen && (
          <div
            ref={flyoutRef}
            className="fixed left-[72px] xl:left-[76px] top-1/2 -translate-y-1/2 z-50 w-72 rounded-3xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/90 dark:border-gray-800 shadow-2xl p-3 flex flex-col gap-1.5 animate-flyout-lateral"
          >
            {/* Tarjeta Banner del módulo */}
            <div className="relative overflow-hidden rounded-2xl bg-[#F6F7F9] dark:bg-gray-800/70 border border-gray-200/60 dark:border-gray-700/60 p-4 mb-1">
              <div className="absolute right-0 bottom-0 pointer-events-none translate-x-2 translate-y-1">
                {ORDERS_WATERMARK}
              </div>

              <button
                type="button"
                onClick={() => setFlyoutModulo(null)}
                className="absolute top-2.5 right-2.5 p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10 cursor-pointer"
                title="Cerrar submenú"
                aria-label="Cerrar submenú"
              >
                <CloseIcon className="h-4 w-4" />
              </button>

              <div className="relative z-1 flex flex-col gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow-2xs border border-black/5 dark:border-white/10 flex items-center justify-center text-gray-900 dark:text-white">
                  <CartIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                    Pedidos
                  </h3>
                </div>
              </div>
            </div>

            {/* Lista de opciones del flyout */}
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto no-scrollbar py-1 flex flex-col gap-0.5">
              {ordersFlyoutItems.map((item) => {
                const active = pathname === item.path || (item.path.endsWith("/dashboard") && (pathname === basePedidos || pathname === `${basePedidos}/`));
                const Icono = item.Icono;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setFlyoutModulo(null)}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? "bg-gray-100 dark:bg-white/10 font-bold text-gray-900 dark:text-white"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110 ${
                        active ? "text-brand-500" : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <Icono className="size-5" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* RAIL ICONS: Opciones recogidas en el rail contraído */}
        <div ref={railRef} className="flex flex-col items-center justify-center gap-2.5 w-full py-1">
          {/* Botón Inicio en Rail Mode */}
          <Link
            to={isPedidosActive ? `${basePedidos}/dashboard` : (homeLink?.to ?? `/business/app/${resolvedBusinessId}`)}
            title="Inicio"
            aria-label="Inicio"
            className={`group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer ${
              isHomeActive
                ? "text-brand-500 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-400 scale-105"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5"
            }`}
          >
            <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
              <HomeIcon className="h-5 w-5" />
            </span>
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3F1A] shadow-[0_0_8px_#FF3F1A] ring-1.5 ring-white dark:ring-gray-900" />
            </span>
          </Link>

          {/* Módulo Pedidos: Botón que abre el flyout submenu */}
          {isPedidosModule && (
            <button
              type="button"
              title="Pedidos"
              aria-label="Pedidos"
              onClick={() => setFlyoutModulo(isPedidosFlyoutOpen ? null : "pedidos")}
              className={`group flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer ${
                isPedidosActive || isPedidosFlyoutOpen
                  ? "text-brand-500 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-400 scale-105"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5"
              }`}
            >
              <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <CartIcon className="h-5 w-5" />
              </span>
            </button>
          )}

          {/* Configuración */}
          {settingsItem && (
            <Link
              to={settingsItem.to}
              title={settingsItem.label}
              aria-label={settingsItem.label}
              className={`group flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer ${
                isSettingsActive
                  ? "text-brand-500 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-400 scale-105"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5"
              }`}
            >
              <span className="h-5 w-5 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <Cog6ToothIcon className="h-5 w-5" />
              </span>
            </Link>
          )}
        </div>

        {/* Footer: Línea separadora, Ayuda y Cerrar sesión */}
        <div className="border-t border-gray-200/70 dark:border-white/5 pt-2 pb-1 mt-2">
          <ul className="flex flex-col gap-1.5 items-center">
            <li>
              <Link
                to="/ayuda"
                className="group flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-[#190088] dark:text-gray-500 dark:hover:text-[#97D6DF] hover:bg-gray-100/70 dark:hover:bg-white/5 transition-all duration-200 hover:scale-110 active:scale-95"
                title="Ayuda"
                aria-label="Ayuda"
              >
                <span className="flex items-center justify-center h-5 w-5 transition-transform duration-200 group-hover:scale-110">
                  <InfoIcon className="h-5 w-5" />
                </span>
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={onSignOut}
                className="group flex items-center justify-center w-10 h-10 rounded-full text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <span className="flex items-center justify-center h-5 w-5 transition-transform duration-200 group-hover:scale-110">
                  <ArrowRightIcon className="h-5 w-5" />
                </span>
              </button>
            </li>
          </ul>
        </div>
      </nav>
    );
  }

  // En modo expandido
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
              <ArrowRightIcon className="h-5 w-5" />
            </span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </nav>
  );
});
