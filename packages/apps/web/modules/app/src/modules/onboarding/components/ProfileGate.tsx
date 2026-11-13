import { observer } from "mobx-react-lite";
import { useEffect, type ReactNode } from "react";
import { Alert } from "@/elements/ui/alert";
import type { Profile } from "../api/onboardingApi";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";
import { serviceErrorMessage } from "../serviceErrors";

interface ProfileGateProps {
  /** Se llama solo cuando el perfil ya cargó. */
  children: (profile: Profile) => ReactNode;
}

/**
 * Carga el perfil al abrirse la pantalla y muestra "Cargando..." o el error del servicio
 * (con "Reintentar") hasta que esté listo. Así cada paso arranca ya con los datos guardados.
 */
export const ProfileGate = observer(({ children }: ProfileGateProps) => {
  useEffect(() => {
    void onboardingProfileStore.load();
  }, []);

  const { status, profile, loadError } = onboardingProfileStore;

  if (status === "error" && loadError) {
    return (
      <div className="ob-setup-alert" aria-live="polite">
        <Alert variant="error" title="No pudimos cargar tu perfil" message={serviceErrorMessage(loadError)} />
        <button type="button" className="ob-setup-retry" onClick={() => void onboardingProfileStore.load()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (status !== "ready" || !profile) {
    return (
      <p className="ob-setup-status" role="status">
        Cargando…
      </p>
    );
  }
  return <>{children(profile)}</>;
});
