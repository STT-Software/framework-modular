import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { Alert } from "@/elements/ui/alert";
import { Button } from "@/elements/ui/button";
import { nextOnboardingPath, onboardingProfileStore } from "@/modules/onboarding";

type Check = { state: "pending" } | { state: "complete" } | { state: "incomplete"; to: string } | { state: "error" };

/** Perfil completo ya en memoria (de esta cuenta): completar es definitivo, así que no hace falta volver a pedirlo. */
function knownComplete(): Check {
  return onboardingProfileStore.currentProfile?.completed ? { state: "complete" } : { state: "pending" };
}

/**
 * Gate for the routes that need the onboarding profile (phone and where the person met Necto) to be complete.
 * - If the store already holds this account's complete profile (the person just finished, or came from `/welcome`),
 *   the routes open at once, without asking again and without a blank screen.
 * - Otherwise it asks the backend once: complete -> the routes open; incomplete -> the next onboarding step
 *   (`nextOnboardingPath`); failure (other than 401, which signs out and `RequireSuperAdmin` handles) -> «No pudimos
 *   verificar tu perfil» with «Reintentar».
 *
 * It decides once instead of following the store, so saving the profile (which changes the store) can never
 * close the page the person is already looking at. It must sit inside `RequireSuperAdmin`.
 */
export function RequireOnboardingCompleted() {
  const [check, setCheck] = useState<Check>(knownComplete);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (check.state !== "pending") return;
    let active = true;
    onboardingProfileStore.ensureLoaded({ maxAgeMs: 0 }).then(
      (profile) => {
        if (!active) return;
        setCheck(profile.completed ? { state: "complete" } : { state: "incomplete", to: nextOnboardingPath(profile) });
      },
      (error: unknown) => {
        if (!active) return;
        // 401: la sesión ya se cerró y la puerta de sesión lleva al login; aquí no se muestra nada.
        const unauthorized = (error as { kind?: string } | null)?.kind === "unauthorized";
        if (!unauthorized) setCheck({ state: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [check.state, attempt]);

  if (check.state === "complete") return <Outlet />;
  if (check.state === "incomplete") return <Navigate to={check.to} replace />;
  if (check.state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex w-full max-w-md flex-col items-start gap-4" aria-live="polite">
          <Alert
            variant="error"
            title="No pudimos verificar tu perfil"
            message="Revisa tu conexión e inténtalo de nuevo."
          />
          <Button
            onClick={() => {
              setCheck({ state: "pending" });
              setAttempt((current) => current + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen" role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
