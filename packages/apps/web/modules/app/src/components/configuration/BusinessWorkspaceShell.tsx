import "@/modules/workspace/styles/workspace.css";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import {
  ConfigBusinessSwitcher,
  type ConfigBusinessSwitcherItem,
  type ConfigQuickNavigationItem,
} from "@/components/configuration/ConfigBusinessSwitcher";
import { RoleShieldBadge } from "@/components/configuration/RoleShieldBadge";
import { Breadcrumb, HomeIcon, type BreadcrumbItem } from "@/elements/ui/breadcrumb";
import { AlertIcon, ListIcon, PanelToggleIcon, PieChartIcon, TableIcon, TruckDelivery } from "@/icons";
import {
  WorkspaceNotificationsDropdown,
  WorkspaceSupportDropdown,
  WorkspaceSupportWidget,
} from "@/modules/workspace";
import {
  BaseAppHeader,
  BaseAppShell,
  BaseAppSidebar,
  MenuItem,
  MenuSectionHeader,
  ShellDropdown,
  ThemeToggleButton,
  ToggleAppSidebar,
  useSidebarContext,
} from "@/shell";
import { uiStore } from "@/stores";
import { cn } from "@/utils";

const RAIL_TOOLTIP_CLASSES =
  "hidden xl:flex pointer-events-none absolute left-[52px] items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200/90 bg-white/95 dark:bg-gray-900/95 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white shadow-theme-md backdrop-blur-md opacity-0 -translate-x-1 transition-all duration-150 group-hover/rail:opacity-100 group-hover/rail:translate-x-0 group-focus-visible/rail:opacity-100 group-focus-visible/rail:translate-x-0 z-50";

const HomeGridIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const OrdersBagIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5 7h14l1 13H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-8 6 2.5 2.5L15 11"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TurnosQueueIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const SettingsSlidersIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="10" cy="12" r="2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const SwitchSpaceIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M7 16V4m0 0L3 8m4-4 4 4m6 0v12m0 0 4-4m-4 4-4-4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NE";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function BusinessRailMark({ to }: { to: string }) {
  return (
    <Link
      to={to}
      aria-label="Necto, inicio del espacio de trabajo"
      title="Inicio"
      className="flex items-center justify-center w-11 h-11 rounded-full border border-gray-200/80 bg-white shadow-theme-xs transition-transform duration-200 hover:scale-105 active:scale-95 dark:border-transparent dark:bg-[#190088] dark:shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)] dark:[&_path[fill='#190088']]:fill-white"
    >
      <NectoLogo variant="mark" width={20} height={20} />
    </Link>
  );
}

export interface BusinessWorkspaceNavItem {
  id: string;
  name: string;
  path: string;
  icon: "home" | "pedidos" | "turnos" | "settings" | "switch" | "orders" | "incidents" | "carriers" | "catalog" | "analytics";
  active?: boolean;
  badgeCount?: number | null;
  readyDot?: boolean;
  section?: "workspace" | "sales" | "config";
}

export interface BusinessWorkspaceShellProps {
  businessId: string;
  businessName: string;
  sectionLabel: string;
  subtitle?: string;
  roleLabel: string;
  personName: string;
  personEmail?: string;
  homePath: string;
  businesses: ConfigBusinessSwitcherItem[];
  quickLinks?: ConfigQuickNavigationItem[];
  navItems: BusinessWorkspaceNavItem[];
  onSelectBusiness?: (businessId: string) => void;
  onSwitchSpace: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

function renderNavIcon(kind: BusinessWorkspaceNavItem["icon"], className = "size-5") {
  switch (kind) {
    case "orders": return <ListIcon className={className} />;
    case "incidents": return <AlertIcon className={className} />;
    case "carriers": return <TruckDelivery className={className} />;
    case "catalog": return <TableIcon className={className} />;
    case "analytics": return <PieChartIcon className={className} />;
    case "home":
      return <HomeGridIcon className={className} />;
    case "pedidos":
      return <OrdersBagIcon className={className} />;
    case "turnos":
      return <TurnosQueueIcon className={className} />;
    case "settings":
      return <SettingsSlidersIcon className={className} />;
    case "switch":
      return <SwitchSpaceIcon className={className} />;
  }
}

export const BusinessWorkspaceShell = observer(
  ({
    businessId,
    businessName,
    sectionLabel,
    subtitle = "Espacio de trabajo",
    roleLabel,
    personName,
    personEmail,
    homePath,
    businesses,
    quickLinks = [],
    navItems,
    onSelectBusiness,
    onSwitchSpace,
    onSignOut,
    signingOut = false,
    disabled = false,
    className,
    children,
  }: BusinessWorkspaceShellProps) => {
    const breadcrumbItems: BreadcrumbItem[] = [
      { label: businessName, href: homePath, icon: <HomeIcon /> },
      { label: sectionLabel },
    ];

    return (
      <BaseAppShell
        className="ws ws-enter"
        sidebar={
          <BaseAppSidebar
            logo={
              <Link
                className="ws-brand flex items-center"
                to={homePath}
                onClick={() => uiStore.closeMobileSidebar()}
                title={`NECTO · ${businessName}`}
                aria-label={`Necto, inicio de ${businessName}`}
              >
                <NectoLogo width={144} height={21} />
              </Link>
            }
            bareRail
          >
            <BusinessSidebarContent
              businessName={businessName}
              roleLabel={roleLabel}
              navItems={navItems}
              onSwitchSpace={onSwitchSpace}
              onSignOut={onSignOut}
              signingOut={signingOut}
            />
          </BaseAppSidebar>
        }
        header={
          <BaseAppHeader
            leftContent={
              <div className="flex items-center gap-3 min-w-0">
                <ToggleAppSidebar collapsedSlot={<BusinessRailMark to={homePath} />} />

                <ConfigBusinessSwitcher
                  currentBusinessId={businessId}
                  currentBusinessName={businessName}
                  subtitle={subtitle}
                  businesses={businesses}
                  quickLinks={quickLinks}
                  onSwitchSpace={onSwitchSpace}
                  disabled={disabled || signingOut}
                  onSelect={onSelectBusiness}
                />

                <span
                  className="hidden md:block h-5 w-px bg-gray-200/80 dark:bg-white/10 shrink-0"
                  aria-hidden="true"
                />

                <Breadcrumb
                  separator="chevron"
                  items={breadcrumbItems}
                  className="hidden md:flex items-center min-w-0"
                />
              </div>
            }
            mobileLogo={
              <Link
                className="ws-brand sm:hidden flex items-center"
                to={homePath}
                aria-label={`Necto, inicio de ${businessName}`}
              >
                <NectoLogo width={116} height={17} />
              </Link>
            }
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <RoleShieldBadge role={roleLabel} />

              <ThemeToggleButton className="h-11 w-11" />

              <WorkspaceSupportDropdown />

              <WorkspaceNotificationsDropdown />

              <BusinessUserDropdown
                personName={personName}
                personEmail={personEmail}
                roleLabel={roleLabel}
                onSwitchSpace={onSwitchSpace}
                onSignOut={onSignOut}
                signingOut={signingOut}
              />
            </div>
          </BaseAppHeader>
        }
      >
        <div
          className={cn("ws-shell-inner is-workspace-shell flex-1 flex flex-col", className)}
          style={{ maxWidth: "none" }}
        >
          {children}
        </div>

        <footer className="ws-page-footer mt-auto">
          <span>© 2026 Necto</span>
          <span>Conecta. Comparte. Crece.</span>
        </footer>

        <WorkspaceSupportWidget />
      </BaseAppShell>
    );
  },
);

const BusinessSidebarContent = observer(
  ({
    businessName,
    roleLabel,
    navItems,
    onSwitchSpace,
    onSignOut,
    signingOut,
  }: {
    businessName: string;
    roleLabel: string;
    navItems: BusinessWorkspaceNavItem[];
    onSwitchSpace: () => void;
    onSignOut: () => void;
    signingOut: boolean;
  }) => {
    const { isExpanded } = useSidebarContext();
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const toggleSection = (id: string) => {
      setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const [salesOpen, setSalesOpen] = useState(false);
    const salesButton = useRef<HTMLButtonElement>(null);
    const salesItems = navItems.filter(item => item.section === "sales");
    const workspaceItems = navItems.filter((item) => (item.section ?? "workspace") === "workspace");
    const configItems = navItems.filter((item) => item.section === "config");

    const railButtonClass = (active: boolean) =>
      cn(
        "group/rail relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ease-out hover:scale-105 active:scale-95 cursor-pointer",
        active
          ? "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
      );

    const railPillClass =
      "flex flex-col items-center gap-2 rounded-full border border-gray-200/80 bg-white p-1.5 shadow-theme-xs dark:border-white/10 dark:bg-gray-900";

    if (!isExpanded) {
      return (
        <nav className="flex h-full flex-col items-center w-full" aria-label="Menú rápido del negocio">
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

            {navItems.filter(item => item.section !== "sales").map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end
                aria-label={item.name}
                className={() => railButtonClass(Boolean(item.active))}
              >
                {renderNavIcon(item.icon, "h-5 w-5")}
                {item.readyDot && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3F1A] ring-1.5 ring-white dark:ring-gray-900" />
                  </span>
                )}
                <span className={RAIL_TOOLTIP_CLASSES}>
                  <span>{item.name}</span>
                  {item.badgeCount != null && (
                    <span className="rounded-md bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                      {item.badgeCount}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
            {salesItems.length > 0 && (
              <div className="relative">
                <button type="button" ref={salesButton} className={railButtonClass(salesItems.some(item => item.active))}
                  onClick={() => setSalesOpen(open => !open)} aria-expanded={salesOpen} aria-label="Ventas">
                  <OrdersBagIcon />
                  <span className={RAIL_TOOLTIP_CLASSES}>Ventas</span>
                </button>
                <ShellDropdown isOpen={salesOpen} triggerRef={salesButton} onClose={() => setSalesOpen(false)}
                  aria-label="Ventas" className="absolute left-full top-1/2 z-50 ml-4 w-64 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  <strong className="mb-2 block rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">Ventas</strong>
                  {salesItems.map(item => (
                    <Link key={item.id} to={item.path} onClick={() => setSalesOpen(false)}
                      aria-current={item.active ? "page" : undefined}
                      className={cn("menu-item group", item.active ? "menu-item-active" : "menu-item-inactive")}>
                      {renderNavIcon(item.icon, "size-4")} {item.name}
                    </Link>
                  ))}
                </ShellDropdown>
              </div>
            )}
          </div>

          <div className={railPillClass}>
            <button
              type="button"
              onClick={onSwitchSpace}
              aria-label="Cambiar rol o espacio"
              className={railButtonClass(false)}
            >
              <SwitchSpaceIcon className="h-5 w-5" />
              <span className={RAIL_TOOLTIP_CLASSES}>Cambiar rol o espacio</span>
            </button>
            <button
              type="button"
              disabled={signingOut}
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
      <nav className="flex flex-col flex-1" aria-label="Menú principal del negocio">
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white dark:border-white/10 dark:bg-gray-800"
            aria-hidden="true"
          >
            <NectoLogo variant="mark" width={18} height={18} />
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-sm font-semibold text-gray-900 dark:text-white leading-tight">
              {businessName}
            </strong>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {roleLabel} · Espacio en Necto
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <MenuSectionHeader
              title="Espacio de trabajo"
              collapsible
              isCollapsed={Boolean(collapsedSections.workspace)}
              onToggle={() => toggleSection("workspace")}
            />
            <div
              className={`transition-all duration-200 ease-in-out overflow-hidden ${
                collapsedSections.workspace ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
              }`}
            >
              <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
                {workspaceItems.map((item) => (
                  <MenuItem
                    key={item.id}
                    icon={renderNavIcon(item.icon)}
                    name={item.name}
                    path={item.path}
                    isActive={() => Boolean(item.active)}
                    cuenta={item.badgeCount ?? null}
                  />
                ))}
              </ul>
            </div>
          </div>

          {salesItems.length > 0 && (
            <div>
              <MenuSectionHeader title="Ventas" collapsible isCollapsed={Boolean(collapsedSections.sales)}
                onToggle={() => toggleSection("sales")} />
              {!collapsedSections.sales && (
                <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
                  {salesItems.map(item => <MenuItem key={item.id} icon={renderNavIcon(item.icon)}
                    name={item.name} path={item.path} isActive={() => Boolean(item.active)} />)}
                </ul>
              )}
            </div>
          )}
          <div>
            <MenuSectionHeader
              title="Configuración y cuenta"
              collapsible
              isCollapsed={Boolean(collapsedSections.config)}
              onToggle={() => toggleSection("config")}
            />
            <div
              className={`transition-all duration-200 ease-in-out overflow-hidden ${
                collapsedSections.config ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
              }`}
            >
              <ul className="flex flex-col gap-1" onClick={() => uiStore.closeMobileSidebar()}>
                {configItems.map((item) => (
                  <MenuItem
                    key={item.id}
                    icon={renderNavIcon(item.icon)}
                    name={item.name}
                    path={item.path}
                    isActive={() => Boolean(item.active)}
                    cuenta={item.badgeCount ?? null}
                  />
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      uiStore.closeMobileSidebar();
                      onSwitchSpace();
                    }}
                    className="menu-item menu-item-inactive group cursor-pointer w-full text-left"
                  >
                    <span className="menu-item-icon-size menu-item-icon-inactive">
                      <SwitchSpaceIcon />
                    </span>
                    <span className="menu-item-text">Cambiar rol o espacio</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 pb-5">
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

          <div className="mt-4 border-t border-gray-200/70 dark:border-white/5 pt-3">
            <button
              type="button"
              disabled={signingOut}
              onClick={onSignOut}
              className="menu-item group text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 cursor-pointer w-full text-left"
            >
              <span className="menu-item-icon-size text-error-700 dark:text-error-400">
                <SignOutIcon />
              </span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </nav>
    );
  },
);

function BusinessUserDropdown({
  personName,
  personEmail,
  roleLabel,
  onSwitchSpace,
  onSignOut,
  signingOut,
}: {
  personName: string;
  personEmail?: string;
  roleLabel: string;
  onSwitchSpace: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = computeInitials(personName);
  const firstName = personName.trim().split(/\s+/)[0] || personName;

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 text-gray-800 dark:text-gray-100 hover:opacity-85 transition-opacity cursor-pointer select-none"
        aria-expanded={isOpen}
        aria-label="Menú de usuario del negocio"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-200 p-0.5 dark:bg-accent-500/25 shrink-0">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold uppercase text-ink-title dark:bg-gray-800 dark:text-white">
            {initials}
          </span>
        </span>

        <span className="hidden sm:block max-w-[130px] truncate text-sm font-semibold text-gray-900 dark:text-white">
          {firstName}
        </span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="16"
          height="16"
          viewBox="0 0 18 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <ShellDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        className="absolute right-0 mt-3.5 flex w-[256px] flex-col rounded-2xl border border-gray-200/90 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 z-50 font-sans animate-entrada-menu"
      >
        <div className="px-2 pt-1 pb-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
            {personName}
          </span>
          {personEmail && (
            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
              {personEmail}
            </span>
          )}
          <span className="mt-1 inline-block rounded-md bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {roleLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1 py-2 border-b border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onSwitchSpace();
            }}
            className="flex items-center gap-2.5 px-3 py-2 font-medium text-gray-700 rounded-xl text-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors cursor-pointer text-left"
          >
            Cambiar rol o espacio (¿Dónde comenzamos?)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate("/super/login");
            }}
            className="flex items-center gap-2.5 px-3 py-2 font-medium text-gray-500 rounded-xl text-xs hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors cursor-pointer text-left"
          >
            Ir a Superadministrador
          </button>
        </div>

        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setIsOpen(false);
            onSignOut();
          }}
          className="mt-2 flex items-center gap-2.5 px-3 py-2 font-medium text-error-700 dark:text-error-400 rounded-xl text-sm hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors cursor-pointer text-left"
        >
          Cerrar sesión
        </button>
      </ShellDropdown>
    </div>
  );
}
