import { useEffect, useRef, useState } from "react";
import { Button } from "@/elements/ui/button";
import { PageMeta } from "@/shell/meta";
import { cn } from "@/utils";
import { BusinessDirectory } from "../components/BusinessDirectory";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { BUSINESS_COUNT } from "../businesses";

/** How long the "create business" glow stays on the shop. */
const CREATE_FEEDBACK_MS = 800;

/**
 * The workspace: where a super admin lands after logging in and completing the profile. Today it shows the
 * directory of businesses, empty, with the animated invitation to create the first one.
 */
export default function WorkspacePage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackTimer = useRef<number>();
  const [entering, setEntering] = useState(true);
  const [createRequested, setCreateRequested] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(feedbackTimer.current);
  }, []);

  /** Plays the entrance animation again: the class has to be removed and put back for CSS to restart it. */
  function replay() {
    setEntering(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntering(true)));
  }

  function handleCreate() {
    window.clearTimeout(feedbackTimer.current);
    setCreateRequested(true);
    setAnnouncement("Crear negocio seleccionado.");
    feedbackTimer.current = window.setTimeout(() => setCreateRequested(false), CREATE_FEEDBACK_MS);
  }

  return (
    <WorkspaceLayout
      section="Negocios"
      className={cn(entering && "ws-enter", createRequested && "ws-create-requested")}
      announcement={announcement}
    >
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
          <span title="Disponible cuando tengas negocios para exportar">
            <Button variant="outline" className="ws-secondary" disabled>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Exportar CSV
            </Button>
          </span>
          <Button className="ws-primary" onClick={handleCreate}>
            <span aria-hidden="true">+</span>Crear negocio
          </Button>
        </div>
      </div>

      <BusinessDirectory businessCount={BUSINESS_COUNT} onCreate={handleCreate} onReplay={replay} />
    </WorkspaceLayout>
  );
}
