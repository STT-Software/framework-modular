import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link, useLocation } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { Breadcrumb, HomeIcon, type BreadcrumbItem } from "@/elements/ui/breadcrumb";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import {
  BaseAppHeader,
  ShellDropdown,
  ShellDropdownItem,
  ThemeToggleButton,
  ToggleAppSidebar,
} from "@/shell";
import { initialsOf } from "../initials";
import { WorkspaceBusinessSwitcher } from "./WorkspaceBusinessSwitcher";
import { WorkspaceNotificationsDropdown } from "./WorkspaceNotificationsDropdown";
import { WorkspaceRailMark } from "./WorkspaceSidebar";
import { WorkspaceSupportDropdown } from "./WorkspaceSupportDropdown";
import { NEW_BUSINESS_PATH, PROFILE_PATH, WORKSPACE_PATH } from "../paths";

/**
 * Workspace top navbar built with Shell's BaseAppHeader + ToggleAppSidebar + Elements Breadcrumb,
 * styled to match StockFlow's floating navbar and user account menu.
 */
export const WorkspaceTopbar = observer(({ section }: { section: string }) => {
  const superAdmin = superAdminSessionStore.superAdmin;
  const username = superAdmin?.username ?? "Mi cuenta";
  const initials = initialsOf(superAdmin?.username);

  const breadcrumbItems: BreadcrumbItem[] =
    section === "Negocios"
      ? [
          { label: "Mi workspace", href: WORKSPACE_PATH, icon: <HomeIcon /> },
          { label: "Negocios" },
        ]
      : [
          { label: "Negocios", href: WORKSPACE_PATH, icon: <HomeIcon /> },
          { label: section },
        ];

  return (
    <BaseAppHeader
      leftContent={
        <div className="flex items-center gap-3 min-w-0">
          <ToggleAppSidebar collapsedSlot={<WorkspaceRailMark />} />

          <WorkspaceBusinessSwitcher />

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
          to={WORKSPACE_PATH}
          aria-label="Necto, inicio del workspace"
        >
          <NectoLogo width={116} height={17} />
        </Link>
      }
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50/80 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-ink-title dark:text-accent-300"
          >
            <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.7" />
            <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Superadministrador
        </span>

        <ThemeToggleButton className="h-11 w-11" />

        <WorkspaceSupportDropdown />

        <WorkspaceNotificationsDropdown />

        <WorkspaceUserDropdown
          username={username}
          email={superAdmin?.email}
          initials={initials}
          onSignOut={() => superAdminSessionStore.signOut()}
        />
      </div>
    </BaseAppHeader>
  );
});

interface WorkspaceUserDropdownProps {
  username: string;
  email?: string;
  initials: string;
  onSignOut: () => void;
}

function WorkspaceUserDropdown({
  username,
  email,
  initials,
  onSignOut,
}: WorkspaceUserDropdownProps) {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        aria-label="Menú de cuenta de superadministrador"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-200 p-0.5 dark:bg-accent-500/25 shrink-0">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold uppercase text-ink-title dark:bg-gray-800 dark:text-white">
            {initials}
          </span>
        </span>

        <span className="hidden sm:block max-w-[130px] truncate text-sm font-semibold text-gray-900 dark:text-white">
          {username}
        </span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="16"
          height="16"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
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
            {username}
          </span>
          {email && (
            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
              {email}
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-1 py-2 border-b border-gray-100 dark:border-gray-800">
          <li>
            <ShellDropdownItem
              onItemClick={() => setIsOpen(false)}
              tag="a"
              to={WORKSPACE_PATH}
              className="flex items-center gap-2.5 px-3 py-2 font-medium text-gray-700 rounded-xl text-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
            >
              Directorio de negocios
            </ShellDropdownItem>
          </li>
          <li>
            <ShellDropdownItem
              onItemClick={() => setIsOpen(false)}
              tag="a"
              to={NEW_BUSINESS_PATH}
              className="flex items-center gap-2.5 px-3 py-2 font-medium text-gray-700 rounded-xl text-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
            >
              Crear negocio
            </ShellDropdownItem>
          </li>
          <li>
            <ShellDropdownItem
              onItemClick={() => setIsOpen(false)}
              tag="a"
              to={PROFILE_PATH}
              className="flex items-center gap-2.5 px-3 py-2 font-medium text-gray-700 rounded-xl text-sm hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
            >
              Mi perfil
            </ShellDropdownItem>
          </li>
        </ul>

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

export default WorkspaceTopbar;
