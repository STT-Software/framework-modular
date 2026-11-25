import { useEffect, useState } from "react";
import { adminAccessStore } from "@/modules/business-access";
import { dashboardApi } from "../api/dashboardApi";
/**
 * ¿Ya puede el administrador entrar a su dashboard? Lo dice el servidor (`entry: "dashboard"`: la base y todo módulo que se puede configurar
 * están preparados). Mientras falte algo, o si no se puede saber, es `false`: quien configura por primera vez no ve atajos al dashboard.
 * `version` es cualquier valor que cambie cuando cambia lo guardado (para volver a preguntar).
 */
export function useDashboardReady(businessId: string | undefined, version: unknown): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!businessId) {
      setReady(false);
      return;
    }
    let cancelled = false;
    adminAccessStore
      .withToken((token) => dashboardApi.get(token, businessId))
      .then((state) => {
        if (!cancelled) setReady(state.entry === "dashboard");
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, version]);
  return ready;
}
