import { useCallback, useState } from "react";
import { toastStore } from "@/modules/business-dashboard";
import { isStale, operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
/**
 * Hace una acción del servidor (llamar, completar, pausar...) evitando que se envíe dos veces mientras responde. Si falla dice por qué,
 * y si la pantalla quedó vieja (otro operador ya hizo algo) la vuelve a leer. Devuelve lo que contestó el servidor, o `null` si falló.
 */
export function useAct() {
  const [busy, setBusy] = useState(false);
  const act = useCallback(async <T,>(action: () => Promise<T>, done?: (result: T) => string | void): Promise<T | null> => {
    setBusy(true);
    try {
      const result = await action();
      const message = done?.(result);
      if (message) toastStore.announce(message);
      operationStore.bump();
      return result;
    } catch (error) {
      toastStore.announce(operationErrorMessage(error));
      if (isStale(error)) operationStore.bump();
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  return { act, busy };
}
