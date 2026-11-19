import "../styles/workspace.css";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { BusinessDetailDialog, businessesStore, type Business } from "@/modules/businesses";
import { BaseAppShell } from "@/shell";
import { cn } from "@/utils";
import { editBusinessPath } from "../paths";
import { WorkspaceDetailProvider } from "./WorkspaceDetailContext";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceSupportWidget } from "./WorkspaceSupportWidget";
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [inspectedBusiness, setInspectedBusiness] = useState<Business | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState(announcement);
  const businessCount = businessesStore.count;

  useEffect(() => {
    setInspectedBusiness(null);
  }, [pathname]);

  useEffect(() => {
    if (businessCount === null) {
      void businessesStore.ensureCount();
    }
  }, [businessCount]);

  useEffect(() => {
    setLiveAnnouncement(announcement);
  }, [announcement]);

  const openBusinessDetail = useCallback((business: Business) => {
    setInspectedBusiness(business);
  }, []);

  const closeBusinessDetail = useCallback(() => {
    setInspectedBusiness(null);
  }, []);

  const detailContextValue = useMemo(
    () => ({
      inspectedBusiness,
      openBusinessDetail,
      closeBusinessDetail,
    }),
    [inspectedBusiness, openBusinessDetail, closeBusinessDetail],
  );

  return (
    <WorkspaceDetailProvider value={detailContextValue}>
      <BaseAppShell
        className={cn("ws", className)}
        sidebar={<WorkspaceSidebar businessCount={businessCount} />}
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
          {liveAnnouncement}
        </p>

        <BusinessDetailDialog
          business={inspectedBusiness}
          onClose={closeBusinessDetail}
          onEdit={(business) => {
            closeBusinessDetail();
            navigate(editBusinessPath(business.id));
          }}
          onChanged={(updated) => {
            businessesStore.replace(updated);
            setInspectedBusiness(updated);
          }}
          onAnnounce={setLiveAnnouncement}
        />

        <WorkspaceSupportWidget />
      </BaseAppShell>
    </WorkspaceDetailProvider>
  );
});

export default WorkspaceLayout;
