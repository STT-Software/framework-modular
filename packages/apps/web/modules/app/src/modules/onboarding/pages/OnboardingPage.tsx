import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/700.css";
import "../styles/onboarding.css";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { preloadWorkspacePage } from "@/modules/workspace";
import { PageMeta } from "@/shell/meta";
import { OnboardingHeader } from "../components/OnboardingHeader";
import { StoryProgress } from "../components/StoryProgress";
import { WorkspaceLoader } from "../components/WorkspaceLoader";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useWelcomeSequence } from "../hooks/useWelcomeSequence";
import { hasSeenIntro, markIntroSeen } from "../introSeen";
import { LaunchSequence } from "../scenes/LaunchSequence";
import { SEQUENCE } from "../sequence";
import { nextOnboardingPath, resolveWelcomeMode } from "../flow";
import { PHONE_STEP_PATH } from "../paths";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";

/**
 * Entrada después de iniciar sesión (`/welcome`). Decide qué ve la persona:
 * - **Intro animada** ("Intelligence in motion"): solo a usuarios nuevos y una sola vez por cuenta, en cualquier
 *   dispositivo. Lo decide el servicio (`profile.introSeen`: ya la vio o ya completó el perfil); este navegador además
 *   lo recuerda para no esperar la consulta. Al terminar sigue al paso 1 del perfil (`/welcome/phone`).
 * - **Pantalla de carga «El cruce»** (`WorkspaceLoader`): en todos los demás inicios de sesión. Mientras se anima
 *   consulta el perfil y descarga el workspace; al terminar va a donde diga `nextOnboardingPath` (workspace, paso 2 si
 *   ya hay teléfono, o paso 1), o al paso 1 si no se pudo consultar: ahí se muestran el error y "Reintentar".
 */
/** Antigüedad aceptable del perfil que pidió la página al abrirse, para que la pantalla de carga no lo repita. */
const LOADER_PROFILE_MAX_AGE_MS = 10_000;

const OnboardingPage = observer(function OnboardingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const accountId = superAdminSessionStore.superAdmin?.id ?? "anon";
  // Se decide una sola vez por visita: marcar la intro como vista al empezarla no debe cambiar lo que se muestra.
  // Si este navegador ya sabe que la vio, se va directo a la pantalla de carga sin esperar al servicio.
  const [decision, setDecision] = useState<"loader" | "intro" | null>(() => (hasSeenIntro(accountId) ? "loader" : null));

  // Se decide con el perfil fresco del servicio (`maxAgeMs: 0`; si ya hay una consulta en vuelo se reutiliza): intro
  // solo si la cuenta no la ha visto ni completó el perfil. Si la consulta falla, pantalla de carga: lleva al paso 1,
  // que muestra el error y "Reintentar".
  useEffect(() => {
    let active = true;
    void resolveWelcomeMode(() => onboardingProfileStore.ensureLoaded({ maxAgeMs: 0 })).then((mode) => {
      if (!active) return;
      if (mode === "loader" && onboardingProfileStore.currentProfile) markIntroSeen(accountId);
      setDecision((current) => current ?? mode);
    });
    return () => {
      active = false;
    };
  }, [accountId]);

  const mode: "loader" | "pending" | "intro" = decision ?? "pending";
  const { index, finished } = useWelcomeSequence(mode === "intro" && !reducedMotion);

  // La intro se marca vista al empezar, en el servicio (vale para todos los dispositivos) y en este navegador: si se
  // recarga a la mitad, no se repite. Al terminar sigue al paso 1; con movimiento reducido no hay intro.
  const marked = useRef(false);
  useEffect(() => {
    if (mode !== "intro") return;
    if (!marked.current) {
      marked.current = true;
      markIntroSeen(accountId);
      void onboardingProfileStore.markIntroSeen();
    }
    if (reducedMotion || finished) {
      const profile = onboardingProfileStore.currentProfile;
      navigate(profile ? nextOnboardingPath(profile) : PHONE_STEP_PATH, { replace: true });
    }
  }, [mode, reducedMotion, finished, accountId, navigate]);

  const playing = mode === "intro" && !reducedMotion && !finished;

  return (
    <main className="ob" data-scene={playing ? SEQUENCE[index].id : "done"} aria-label="Bienvenida a Necto">
      <PageMeta title="Necto · Tu primera conexión" />
      <OnboardingHeader />
      <div className="ob-stage">{playing ? <LaunchSequence sceneIndex={index} /> : null}</div>
      {playing ? (
        <footer className="ob-footer">
          <StoryProgress index={index} />
        </footer>
      ) : null}
      {mode === "loader" ? (
        <WorkspaceLoader
          // Reutiliza la consulta de la página (en vuelo o recién llegada): el perfil no se pide dos veces.
          load={() => Promise.all([onboardingProfileStore.ensureLoaded({ maxAgeMs: LOADER_PROFILE_MAX_AGE_MS }), preloadWorkspacePage()])}
          onCovered={() => undefined}
          onDone={() => {
            const profile = onboardingProfileStore.currentProfile;
            navigate(profile ? nextOnboardingPath(profile) : PHONE_STEP_PATH, { replace: true });
          }}
        />
      ) : null}
      <p className="ob-sr-only" role="status" aria-live="polite">
        {playing ? SEQUENCE[index].announce : ""}
      </p>
    </main>
  );
});

export default OnboardingPage;
