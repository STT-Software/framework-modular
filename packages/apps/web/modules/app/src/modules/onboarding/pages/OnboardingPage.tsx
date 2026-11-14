import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/onboarding.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PageMeta } from "@/shell/meta";
import { OnboardingHeader } from "../components/OnboardingHeader";
import { StoryProgress } from "../components/StoryProgress";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useWelcomeSequence } from "../hooks/useWelcomeSequence";
import { ConnectScene } from "../scenes/ConnectScene";
import { GrowScene } from "../scenes/GrowScene";
import { LogoScene } from "../scenes/LogoScene";
import { ReadyScene } from "../scenes/ReadyScene";
import { ShareScene } from "../scenes/ShareScene";
import { READY_ANNOUNCEMENT, SEQUENCE, type SceneId } from "../sequence";
import { AFTER_ONBOARDING_PATH, PHONE_STEP_PATH } from "../paths";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";


const SCENES: Record<SceneId, () => React.JSX.Element> = {
  logo: LogoScene,
  connect: ConnectScene,
  share: ShareScene,
  grow: GrowScene,
};

/**
 * Bienvenida que se ve después de iniciar sesión.
 *
 * - Perfil sin completar: cuatro escenas (logo, conecta, comparte, crece) y una pantalla final con
 *   el botón "Comenzar", que lleva a pedir el teléfono y dónde nos conoció.
 * - Perfil ya completo: solo la primera escena (el logo) y entra solo al workspace.
 *
 * El perfil se consulta mientras suena la primera escena, que es igual para todos. Si la consulta
 * falla se trata como "sin completar": se ve la bienvenida entera y los pasos de perfil muestran
 * el error con su botón para reintentar.
 */
const OnboardingPage = observer(function OnboardingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  // `requested` evita leer un perfil viejo del store (de otra cuenta) antes de pedir el de esta.
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

  const { index, finished } = useWelcomeSequence({
    reducedMotion,
    profileCompleted,
    onProfileCompleted: () => navigate(AFTER_ONBOARDING_PATH, { replace: true }),
  });

  // Con movimiento reducido no se muestra la pantalla final hasta saber que el perfil está sin completar.
  const showReady = finished && !(reducedMotion && profileCompleted !== false);
  const Scene = finished ? null : SCENES[SEQUENCE[index].id];
  const announcement = finished ? (showReady ? READY_ANNOUNCEMENT : "") : SEQUENCE[index].announce;

  return (
    <main className="ob" aria-label="Bienvenida a Necto">
      <PageMeta title="Necto · Tu primera conexión" />
      <div className="ob-grain" aria-hidden="true" />
      <div className="ob-ambient" aria-hidden="true">
        <i />
        <i />
      </div>
      <OnboardingHeader />
      <div className="ob-stage">
        {/* `key` remonta la escena y reinicia sus animaciones. */}
        {Scene ? (
          <Scene key={SEQUENCE[index].id} />
        ) : showReady ? (
          <ReadyScene onContinue={() => navigate(PHONE_STEP_PATH)} />
        ) : null}
      </div>
      <footer className="ob-footer">
        <StoryProgress index={finished ? SEQUENCE.length : index} />
        <span>Conecta. Comparte. Crece.</span>
      </footer>
      <p className="ob-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
});

export default OnboardingPage;
