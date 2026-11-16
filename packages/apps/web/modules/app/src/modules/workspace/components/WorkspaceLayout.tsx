import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/workspace.css";
import { observer } from "mobx-react-lite";
import { useEffect, type ReactNode } from "react";
import { businessesStore } from "@/modules/businesses";
import { BaseAppShell } from "@/shell";
import { cn } from "@/utils";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceTopbar } from "./WorkspaceTopbar";

interface WorkspaceLayoutProps {
  /** Name of the current section, shown in the breadcrumb ("Negocios", "Mi perfil"). */
  section: string;
  /** Extra classes for the root: `ws-enter` plays the entrance animations, for example. */
  className?: string;
  /** Text for screen readers, announced when it changes. */
  announcement?: string;
  children: ReactNode;
}

/** The frame of every workspace screen: built on BaseAppShell (floating sidebar, floating header and floating panel). */
export const WorkspaceLayout = observer(({ section, className, announcement = "", children }: WorkspaceLayoutProps) => {
  useEffect(() => {
    void businessesStore.ensureCount();
  }, []);

  return (
    <BaseAppShell
      className={cn("ws", className)}
      sidebar={<WorkspaceSidebar businessCount={businessesStore.count} />}
      header={<WorkspaceTopbar section={section} />}
    >
      <div className="ws-shell-inner flex-1 flex flex-col">
        {children}
      </div>

      <footer className="ws-page-footer mt-auto">
        <span>© 2026 Necto</span>
        <span>Conecta. Comparte. Crece.</span>
      </footer>

      <p className="ws-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </BaseAppShell>
  );
});

export default WorkspaceLayout;
