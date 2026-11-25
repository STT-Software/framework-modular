import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link, useLocation } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { Breadcrumb, HomeIcon, type BreadcrumbItem } from "@/elements/ui/breadcrumb";
import { BaseAppHeader, ShellDropdown, ShellDropdownItem, ThemeToggleButton, ToggleAppSidebar } from "@/shell";
import { WorkspaceSupportDropdown } from "@/modules/workspace";
import { BusinessRailMark, NavIcon } from "./BusinessSidebar";
import { initials } from "./ui";
export interface BusinessTopbarProps {
  logoTo: string;
  /** Del inicio a la pantalla actual; la última no lleva enlace. */
  crumbs: Array<{ label: string; href?: string }>;
  person: { name: string; email: string; roleLabel: string; isAdmin: boolean };
  /** Hay actividad reciente que mostrar (punto sobre la campana). */
  hasActivity: boolean;
  onOpenActivity: () => void;
  onSignOut: () => void;
  /** Enlaces del menú de la cuenta (además de cerrar sesión). */
  accountLinks: Array<{ to: string; label: string }>;
}
/** La barra superior del administrador y del operador: la misma del superadministrador (`BaseAppHeader`), con su breadcrumb y su menú de cuenta. */
export const BusinessTopbar = observer(({ logoTo, crumbs, person, hasActivity, onOpenActivity, onSignOut, accountLinks }: BusinessTopbarProps) => {
  const items: BreadcrumbItem[] = crumbs.map((crumb, index) => ({ label: crumb.label, href: crumb.href, icon: index === 0 ? <HomeIcon /> : undefined }));
  return (
    <BaseAppHeader
      leftContent={
        <div className="flex items-center gap-3 min-w-0">
          <ToggleAppSidebar />
          <Breadcrumb separator="chevron" items={items} className="hidden md:flex items-center min-w-0" />
        </div>
      }
      mobileLogo={
        <Link className="sm:hidden flex items-center" to={logoTo} aria-label="Necto, inicio">
          <NectoLogo width={116} height={17} />
        </Link>
      }
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50/80 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-ink-title dark:text-accent-300">
            <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.7" />
            <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {person.isAdmin ? "Administrador" : "Operador"}
        </span>
        <ThemeToggleButton className="h-11 w-11" />
        <WorkspaceSupportDropdown />
        <button
          type="button"
          onClick={onOpenActivity}
          aria-label="Ver actividad reciente"
          title="Actividad reciente"
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200/80 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white cursor-pointer"
        >
          <NavIcon name="bell" className="size-5" />
          {hasActivity ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#FF3F1A] ring-2 ring-white dark:ring-gray-900" /> : null}
        </button>
        <BusinessUserDropdown person={person} links={accountLinks} onSignOut={onSignOut} />
      </div>
    </BaseAppHeader>
  );
});
function BusinessUserDropdown({ person, links, onSignOut }: { person: BusinessTopbarProps["person"]; links: BusinessTopbarProps["accountLinks"]; onSignOut: () => void }) {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setIsOpen(false), [pathname]);
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex items-center gap-2 text-gray-800 dark:text-gray-100 hover:opacity-85 transition-opacity cursor-pointer select-none"
        aria-expanded={isOpen}
        aria-label="Menú de mi cuenta"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-200 p-0.5 dark:bg-accent-500/25 shrink-0">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold uppercase text-ink-title dark:bg-gray-800 dark:text-white">{initials(person.name)}</span>
        </span>
        <span className="hidden sm:block max-w-[130px] truncate text-sm font-semibold text-gray-900 dark:text-white">{person.name}</span>
        <svg className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 18 20" fill="none" aria-hidden="true">
          <path d="M4.3125 8.65625L9 13.3437L13.6875 8.65625" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ShellDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        className="absolute right-0 mt-3.5 flex w-[256px] flex-col rounded-2xl border border-gray-200/90 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 z-50 font-sans animate-entrada-menu"
      >
        <div className="px-2 pt-1 pb-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{person.name}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">{person.email}</span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{person.roleLabel}</span>
        </div>
        {links.length > 0 ? (
          <ul className="flex flex-col gap-1 py-2 border-b border-gray-100 dark:border-gray-800">
            {links.map((link) => (
              <li key={link.to}>
                <ShellDropdownItem
                  onItemClick={() => setIsOpen(false)}
                  tag="a"
                  to={link.to}
                  className="flex items-center gap-2.5 px-3 py-2 font-medium text-gray-700 rounded-xl text-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
                >
                  {link.label}
                </ShellDropdownItem>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
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
