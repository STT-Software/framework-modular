import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { onboardingProfileStore } from "@/modules/onboarding";

/**
 * Gate for the routes that need the onboarding profile (phone and where the person met Necto) to be complete.
 * It asks the backend once when entering: complete -> the routes open; incomplete (or the check failed) ->
 * the person goes to /welcome, where the steps show their own errors and a retry button.
 *
 * It decides once instead of following the store, so saving the profile (which changes the store) can never
 * close the page the person is already looking at. It must sit inside `RequireSuperAdmin`.
 */
export function RequireOnboardingCompleted() {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void onboardingProfileStore.load().then(() => {
      if (!active) return;
      const { status, profile } = onboardingProfileStore;
      setCompleted(status === "ready" && profile?.completed === true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (completed === null) {
    return (
      <div className="min-h-screen" role="status" aria-busy="true">
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }
  return completed ? <Outlet /> : <Navigate to="/welcome" replace />;
}
