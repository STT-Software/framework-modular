import { useCallback, useEffect, useRef, useState } from "react";
import { operationStore } from "../stores/operation.store";
import { operationErrorMessage } from "../messages";
export interface Remote<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}
/**
 * Lee lo que muestra una pantalla y lo vuelve a leer cuando cambia lo que pidió (`deps`) o cuando algo pasa en Turnos (el canal en vivo
 * sube `operationStore.revision`). Mientras vuelve a leer conserva lo que ya mostraba, así la pantalla no parpadea.
 */
export function useRemote<T>(load: () => Promise<T>, deps: unknown[], enabled = true): Remote<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const revision = operationStore.revision;
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(operationErrorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision, tick, enabled]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, loading, error, reload };
}
