import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/700.css";
import "../styles/onboarding.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { PageMeta } from "@/shell/meta";
import { preloadWorkspacePage } from "@/modules/workspace";
import { OnboardingHeader } from "../components/OnboardingHeader";
import { WorkspaceLoader } from "../components/WorkspaceLoader";
import { ReadyScene } from "../scenes/ReadyScene";
import { READY_ANNOUNCEMENT } from "../sequence";
import { nextOnboardingPath } from "../flow";
import { AFTER_ONBOARDING_PATH } from "../paths";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";

/**
 * Cierre del onboarding (`/welcome/ready`): la pantalla final con el juego de formas, después de guardar el
 * teléfono y dónde nos conoció. "Ir a mi workspace" abre la pantalla de carga «El cruce» (`WorkspaceLoader`), que
 * descarga el workspace mientras se anima y, al terminar, entra en él.
 *
 * Si el perfil completo ya está en memoria (recién guardado en esta pestaña) se usa tal cual, sin consultar ni
 * parpadear; si no, se asegura con `ensureLoaded`. Con el perfil sin completar va al paso que le falte
 * (`nextOnboardingPath`). Si la consulta falla se muestra igual: el workspace vuelve a comprobar el perfil al entrar.
 */
const ReadyPage = observer(function ReadyPage() {
  const navigate = useNavigate();
  // "show": se muestra el cierre; "pending": aún no se sabe; si el perfil está incompleto, a dónde ir.
  const [state, setState] = useState<"pending" | "show" | { redirect: string }>(() =>
    onboardingProfileStore.currentProfile?.completed ? "show" : "pending",
  );
  // "leaving": la pantalla de carga está entrando; "covered": ya tapa todo y lo de debajo se desmonta (el juego de
  // formas deja de correr).
  const [exit, setExit] = useState<"none" | "leaving" | "covered">("none");
  useEffect(() => {
    if (state !== "pending") return;
    let active = true;
    onboardingProfileStore.ensureLoaded().then(
      (profile) => active && setState(profile.completed ? "show" : { redirect: nextOnboardingPath(profile) }),
      () => active && setState("show"),
    );
    return () => {
      active = false;
    };
  }, [state]);

  if (typeof state === "object") return <Navigate to={state.redirect} replace />;
  const known = state === "show";

  return (
    <main className="ob" data-scene="ready" aria-label="Bienvenida a Necto">
      <PageMeta title="Necto · Todo listo" />
      <OnboardingHeader />
      <div className="ob-stage">
        {known && exit !== "covered" ? <ReadyScene onContinue={() => setExit("leaving")} /> : null}
      </div>
      {exit !== "none" ? (
        <WorkspaceLoader
          load={preloadWorkspacePage}
          onCovered={() => setExit("covered")}
          onDone={() => navigate(AFTER_ONBOARDING_PATH, { replace: true })}
        />
      ) : null}
      <p className="ob-sr-only" role="status" aria-live="polite">
        {known && exit === "none" ? READY_ANNOUNCEMENT : ""}
      </p>
    </main>
  );
});

export default ReadyPage;
