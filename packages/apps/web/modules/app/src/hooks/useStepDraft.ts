import { useState, useEffect, useCallback } from "react";

/**
 * Persists transient step form data in sessionStorage to prevent accidental loss
 * on page reloads or tab closures before saving to the server.
 *
 * @param storageKey Unique key for the draft (e.g. `necto.draft.business-setup.<id>.<step>`)
 * @param initialValue Default value when no saved draft exists in sessionStorage
 * @returns [state, setState, clearDraft]
 */
export function useStepDraft<T>(
  storageKey: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined" || !storageKey) return initialValue;
    try {
      const item = window.sessionStorage.getItem(storageKey);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage quota or private mode restriction
    }
  }, [storageKey, state]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return [state, setState, clearDraft];
}
