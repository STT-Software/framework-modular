import { 
  BaseAppSidebar, 
  MenuSectionHeader,
  MenuItem,
} from "@/shell";
import { GridIcon } from "@/icons";

// ═══════════════════════════════════════════════════════════════════════════
// LOGO COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const Logo = () => (
  <div className="flex items-center gap-2">
    <svg
      className="h-8 w-8 text-blue-600 dark:text-blue-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
    <span className="text-xl font-semibold text-gray-800 dark:text-white">
      Framework Modular
    </span>
  </div>
);

const LogoCollapsed = () => (
  <svg
    className="h-8 w-8 text-blue-600 dark:text-blue-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
    />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR CONTENT - Minimal menu for new applications
// ═══════════════════════════════════════════════════════════════════════════

const SidebarContent = () => {
  const isActive = (path: string) => window.location.pathname === path;

  return (
    <nav className="mb-6">
      <div className="flex flex-col gap-4">
        <div>
          <MenuSectionHeader title="Menu" />
          <ul className="flex flex-col gap-1">
            <MenuItem
              icon={<GridIcon />}
              name="Dashboard"
              path="/"
              isActive={isActive}
            />
            {/* Add more menu items here */}
          </ul>
        </div>
      </div>
    </nav>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AppSidebar is a minimal sidebar for new applications.
 * Customize the Logo, LogoCollapsed, and SidebarContent to fit your needs.
 * 
 * For a full-featured demo with TailAdmin-style menu, see `demo/DemoSidebar`.
 * @kgId 8025fcb3eb97
 */
export const AppSidebar = () => (
  <BaseAppSidebar logo={<Logo />} logoCollapsed={<LogoCollapsed />}>
    <SidebarContent />
  </BaseAppSidebar>
);

export default AppSidebar;
