import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/workspace.css";
import type { ReactNode } from "react";
import { cn } from "@/utils";
import { BUSINESS_COUNT } from "../businesses";
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

/** The frame of every workspace screen: sidebar, top bar and page footer around the screen's own content. */
export function WorkspaceLayout({ section, className, announcement = "", children }: WorkspaceLayoutProps) {
  return (
    <div className={cn("ws", className)}>
      <WorkspaceSidebar businessCount={BUSINESS_COUNT} />

      <div className="ws-body">
        <WorkspaceTopbar section={section} />

        <main className="ws-content">
          {children}
          <footer className="ws-page-footer">
            <span>© 2026 Necto</span>
            <span>Conecta. Comparte. Crece.</span>
          </footer>
        </main>
      </div>

      <p className="ws-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
