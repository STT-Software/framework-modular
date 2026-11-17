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
 * Asegura el perfil al abrirse la pantalla con `ensureLoaded`: si ya está en memoria (venimos de otro paso) se usa tal
 * cual, sin «Cargando…» ni otra consulta; si no, se pide una vez. Si la consulta falla y no hay perfil, muestra el error
 * del servicio con «Reintentar».
 */
export const ProfileGate = observer(({ children }: ProfileGateProps) => {
  useEffect(() => {
    // El error ya queda en el store (`loadError`) y se muestra abajo.
    onboardingProfileStore.ensureLoaded().catch(() => undefined);
  }, []);

  const profile = onboardingProfileStore.currentProfile;
  const { status, loadError } = onboardingProfileStore;

  if (profile) return <>{children(profile)}</>;
  if (status === "error" && loadError) {
    return (
      <div className="ob-setup-alert" aria-live="polite">
        <Alert variant="error" title="No pudimos cargar tu perfil" message={serviceErrorMessage(loadError)} />
        <button
          type="button"
          className="ob-setup-retry"
          onClick={() => onboardingProfileStore.ensureLoaded({ maxAgeMs: 0 }).catch(() => undefined)}
        >
          Reintentar
        </button>
      </div>
    );
  }
  return (
    <p className="ob-setup-status" role="status">
      Cargando…
    </p>
  );
});
