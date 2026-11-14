import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/elements/ui/button";
import { businessErrorMessage, businessesApi, businessesStore, downloadBlob } from "@/modules/businesses";
import { PageMeta } from "@/shell/meta";
import { cn } from "@/utils";
import { BusinessDirectory } from "../components/BusinessDirectory";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { editBusinessPath, NEW_BUSINESS_PATH } from "../paths";

/**
 * The workspace: where a super admin lands after logging in and completing the profile. It shows the directory
 * of their businesses (or the animated invitation to create the first one) and leads to create, edit and export.
 */
const WorkspacePage = observer(() => {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [entering, setEntering] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const store = businessesStore;
  const notice = store.notice;
  const hasBusinesses = (store.count ?? store.total) > 0;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (notice) setAnnouncement(notice);
  }, [notice]);

  /** Plays the entrance animation again: the class has to be removed and put back for CSS to restart it. */
  function replay() {
    setEntering(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntering(true)));
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      downloadBlob(await businessesApi.exportCsv(store.filters), "negocios-necto.csv");
      setAnnouncement("Exportación lista: negocios-necto.csv");
    } catch (failure) {
      setExportError(businessErrorMessage(failure));
    } finally {
      setExporting(false);
    }
  }

  return (
    <WorkspaceLayout section="Negocios" className={cn(entering && "ws-enter")} announcement={announcement}>
      <PageMeta title="Necto · Workspace de negocios" />
      <div className="ws-heading">
        <div>
          <span className="ws-eyebrow">TU WORKSPACE</span>
          <h1 id="ws-title" ref={headingRef} tabIndex={-1}>
            Directorio de negocios
          </h1>
          <p>Crea y organiza los negocios que administras en Necto.</p>
        </div>
        <div className="ws-heading-actions">
          <span title={hasBusinesses ? "Exportar los negocios de esta vista" : "Disponible cuando tengas negocios para exportar"}>
            <Button variant="outline" className="ws-secondary" disabled={!hasBusinesses || exporting} onClick={() => void exportCsv()}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          </span>
          <Button className="ws-primary" onClick={() => navigate(NEW_BUSINESS_PATH)}>
            <span aria-hidden="true">+</span>Crear negocio
          </Button>
        </div>
      </div>
      {notice && (
        <p className="bs-complete-banner bs-notice" role="status">
          <span>✓ {notice}</span>
          <button type="button" onClick={() => store.setNotice(null)}>
            Cerrar
          </button>
        </p>
      )}
      {exportError && (
        <p className="bs-error-banner" role="alert">
          {exportError}
        </p>
      )}
      <BusinessDirectory
        onCreate={() => navigate(NEW_BUSINESS_PATH)}
        onReplay={replay}
        onEdit={(business) => navigate(editBusinessPath(business.id))}
        onAnnounce={setAnnouncement}
      />
    </WorkspaceLayout>
  );
});

export default WorkspacePage;
