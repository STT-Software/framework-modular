import { useEffect, useState } from "react";
import { SEQUENCE } from "../sequence";

/**
 * Avanza por las escenas de la intro con un temporizador mientras `active` es true.
 * `index` es la escena actual; al terminar la última, `finished` pasa a true.
 */
export function useWelcomeSequence(active: boolean) {
  const [index, setIndex] = useState(0);
  const finished = index >= SEQUENCE.length;

  useEffect(() => {
    if (!active || finished) return;
    const timer = window.setTimeout(() => setIndex((current) => current + 1), SEQUENCE[index].duration);
    return () => window.clearTimeout(timer);
  }, [active, index, finished]);

  return { index, finished };
}
