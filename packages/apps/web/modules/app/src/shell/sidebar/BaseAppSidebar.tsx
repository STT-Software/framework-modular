import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { observer } from 'mobx-react-lite';
import { uiStore } from "@/stores";
import { SidebarProvider } from "@/shell/sidebar/SidebarContext";

interface BaseAppSidebarProps {
  logo?: ReactNode;
  logoCollapsed?: ReactNode;
  children?: ReactNode;
  /** When true, uses relative positioning instead of fixed (for showcases/embedded use) */
  contained?: boolean;
  /**
   * Override for collapsed state. When defined (true/false), ignores store state.
   * Use only for showcases/documentation - not for runtime control.
   */
  collapsed?: boolean;
  /**
   * Collapsed look without the pill: no card (background, border, shadow), full height below the expand button, so the
   * content lays out its own floating icon buttons (e.g. navigation centered, sign out at the bottom).
   */
  bareRail?: boolean;
}

/** Top of the bare rail: below the expand button of the top-left corner. */
const BARE_RAIL_TOP = 100;

/** Duración del cambio de tamaño. Al contraer es más corta: cerrar no se espera. */
const MS_EXPANDIR = 340;
const MS_CONTRAER = 280;

/** Ancho de la píldora contraída. El radio es la mitad: así queda redonda sin usar 9999px. */
const ANCHO_CONTRAIDA = 54;

/**
 * Floating sidebar shell with explicit geometry transitions:
 * - Expanded: full-height floating card anchored at top 16px with 24px radius
 * - Collapsed: vertically centered floating rail pill sized to its icons
 */
export const BaseAppSidebar: React.FC<BaseAppSidebarProps> = observer(({
  logo,
  logoCollapsed,
  children,
  contained = false,
  collapsed,
  bareRail = false,
}) => {
  // If collapsed prop is defined, use it as override; otherwise use store
  const showExpanded = collapsed !== undefined
    ? !collapsed
    : uiStore.isSidebarVisible;

  // Natural height of the collapsed pill: compact logo + navigation icons + vertical padding.
  const medidor = useRef<HTMLDivElement>(null);
  const [altoContraida, setAltoContraida] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (showExpanded || bareRail || !medidor.current) return;
    const medir = () => {
      // 24px from py-3 + 2px from 1px top/bottom borders.
      if (medidor.current) setAltoContraida(medidor.current.offsetHeight + 26);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(medidor.current);
    return () => ro.disconnect();
  }, [showExpanded, bareRail]);

  // Clip overflowing labels only while animating so hover tooltips/flyouts are never clipped once settled.
  const [viajando, setViajando] = useState(false);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setViajando(true);
    const t = setTimeout(() => setViajando(false), showExpanded ? MS_EXPANDIR : MS_CONTRAER);
    return () => clearTimeout(t);
  }, [showExpanded]);

  // Skip initial mount animation so opening a route never flashes a layout jump.
  const [animable, setAnimable] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setAnimable(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const duracion = showExpanded ? MS_EXPANDIR : MS_CONTRAER;
  const expandida: React.CSSProperties = { top: 16, height: "calc(100vh - 2rem)", borderRadius: 24 };
  const bare = bareRail && !showExpanded;
  const geometria: React.CSSProperties = contained
    ? {}
    : bare
      ? { top: BARE_RAIL_TOP, height: `calc(100vh - ${BARE_RAIL_TOP + 16}px)`, borderRadius: 0 }
      : showExpanded || !altoContraida
      ? { ...expandida, ...(showExpanded ? {} : { borderRadius: ANCHO_CONTRAIDA / 2 }) }
      : { top: `calc(50vh - ${altoContraida / 2}px)`, height: altoContraida, borderRadius: ANCHO_CONTRAIDA / 2 };

  const positionClasses = contained
    ? "relative h-full"
    : `fixed left-4 z-50 max-h-[calc(100vh-2rem)] ${uiStore.sidebarMobileOpen ? "translate-x-0" : "-translate-x-[120%]"} xl:translate-x-0`;

  return (
    <SidebarProvider collapsed={collapsed}>
      <aside
        style={{
          ...geometria,
          transitionDuration: `${duracion}ms`,
        }}
        aria-label="Barra lateral de navegación"
        className={`barra-lateral flex flex-col border text-gray-900 dark:text-gray-100 ${
          bare
            ? "border-transparent bg-transparent shadow-none"
            : "border-gray-200/80 bg-white dark:border-white/10 dark:bg-gray-900 shadow-theme-xs"
        }
          ${animable ? "transition-[width,height,top,border-radius,padding,translate] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none" : ""}
          ${positionClasses}
          ${viajando ? "overflow-hidden" : ""}
          ${showExpanded ? "w-[274px] px-5" : "w-[54px] px-1.5 py-3"}`}
      >
        <div ref={medidor} className={showExpanded ? "contents" : bare ? "flex flex-col h-full" : "flex flex-col"}>
          {/* Logo section */}
          {(showExpanded || !bare || logoCollapsed) && (
          <div
            className={`flex shrink-0 ${
              showExpanded ? "pt-6 pb-5 justify-start" : "pb-2 pt-0.5 justify-center"
            }`}
          >
            <div key={showExpanded ? "expandido" : "colapsado"} className="barra-lateral__entrada">
              {showExpanded ? logo : logoCollapsed}
            </div>
          </div>
          )}

          {/* Content section */}
          <div
            key={showExpanded ? "expandido" : "colapsado"}
            className={`barra-lateral__entrada flex flex-col no-scrollbar ${
              showExpanded ? "flex-1 overflow-y-auto" : bare ? "flex-1 min-h-0" : "flex-initial"
            }`}
          >
            {children}
          </div>
        </div>
      </aside>
    </SidebarProvider>
  );
});

export default BaseAppSidebar;
