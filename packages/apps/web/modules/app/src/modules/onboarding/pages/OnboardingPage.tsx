import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/700.css";
import "../styles/onboarding.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PageMeta } from "@/shell/meta";
import { OnboardingHeader } from "../components/OnboardingHeader";
import { StoryProgress } from "../components/StoryProgress";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useWelcomeSequence } from "../hooks/useWelcomeSequence";
import { LaunchSequence } from "../scenes/LaunchSequence";
import { ReadyScene } from "../scenes/ReadyScene";
import { READY_ANNOUNCEMENT, SEQUENCE } from "../sequence";
import { AFTER_ONBOARDING_PATH, PHONE_STEP_PATH } from "../paths";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";

/**
 * Bienvenida que se ve después de iniciar sesión (`/welcome`):
 * - Perfil sin completar: secuencia continua de 4 actos ("Intelligence in motion") y cierre ReadyScene.
 * - Perfil ya completo: reproduce el primer tramo mientras valida el perfil y entra directo al workspace.
 */
const OnboardingPage = observer(function OnboardingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  // `requested` evita leer un perfil viejo del store antes de pedir el de la cuenta activa.
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    void onboardingProfileStore.load();
    setRequested(true);
  }, []);
  const { status, profile } = onboardingProfileStore;
  const profileCompleted: boolean | null = !requested
    ? null
    : status === "ready"
      ? Boolean(profile?.completed)
      : status === "error"
        ? false
        : null;

  const { index, finished, holding, canSkip, skip } = useWelcomeSequence({
    reducedMotion,
    profileCompleted,
    onProfileCompleted: () => navigate(AFTER_ONBOARDING_PATH, { replace: true }),
  });

  const showReady = finished && !(reducedMotion && profileCompleted !== false);
  const sceneKey = finished ? (showReady ? "ready" : "done") : SEQUENCE[index].id;
  const announcement = finished ? (showReady ? READY_ANNOUNCEMENT : "") : SEQUENCE[index].announce;

  return (
    <main className="ob" data-scene={sceneKey} aria-label="Bienvenida a Necto">
      <PageMeta title="Necto · Tu primera conexión" />
      <OnboardingHeader />
      <div className="ob-stage">
        {!finished ? (
          <LaunchSequence sceneIndex={index} holding={holding} />
        ) : showReady ? (
          <ReadyScene onContinue={() => navigate(PHONE_STEP_PATH)} />
        ) : null}
      </div>
      <footer className="ob-footer">
        <StoryProgress index={finished ? SEQUENCE.length : index} />
        {canSkip ? (
          <button type="button" className="ob-skip" onClick={skip}>
            Saltar intro <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </footer>
      <p className="ob-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
});

export default OnboardingPage;
