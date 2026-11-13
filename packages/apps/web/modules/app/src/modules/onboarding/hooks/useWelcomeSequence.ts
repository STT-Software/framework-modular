import { useEffect, useRef, useState } from "react";
import { SEQUENCE } from "../sequence";

interface WelcomeSequenceOptions {
  reducedMotion: boolean;
  /**
   * Si la persona ya completó su perfil: `null` mientras se consulta, `true` o `false` cuando se sabe.
   * Quien ya lo completó solo ve la primera escena y se llama a `onProfileCompleted`.
   */
  profileCompleted: boolean | null;
  onProfileCompleted: () => void;
}

/**
 * Avanza por las escenas de la bienvenida con un temporizador.
 *
 * - `index` es la escena actual; al terminar la última, `finished` pasa a true.
 * - La primera escena es igual para todos. Al terminar, si el perfil ya está completo se llama a
 *   `onProfileCompleted` y la secuencia no sigue; si no, continúa con el resto. Si aún no se sabe,
 *   la primera escena se queda en pantalla hasta saberlo.
 * - Con movimiento reducido no hay secuencia: se va directo a la pantalla final (o, con el perfil
 *   completo, a `onProfileCompleted`).
 */
export function useWelcomeSequence({ reducedMotion, profileCompleted, onProfileCompleted }: WelcomeSequenceOptions) {
  const [index, setIndex] = useState(0);
  const [introElapsed, setIntroElapsed] = useState(false);
  const finished = reducedMotion || index >= SEQUENCE.length;

  // Siempre la última versión, sin reiniciar los efectos cuando cambia la función.
  const onCompletedRef = useRef(onProfileCompleted);
  onCompletedRef.current = onProfileCompleted;

  useEffect(() => {
    if (finished || (index === 0 && introElapsed)) return;
    const timer = window.setTimeout(() => {
      if (index === 0) setIntroElapsed(true);
      else setIndex((current) => current + 1);
    }, SEQUENCE[index].duration);
    return () => window.clearTimeout(timer);
  }, [index, finished, introElapsed]);

  useEffect(() => {
    if (reducedMotion) {
      if (profileCompleted) onCompletedRef.current();
      return;
    }
    if (index !== 0 || !introElapsed || profileCompleted === null) return;
    if (profileCompleted) onCompletedRef.current();
    else setIndex(1);
  }, [reducedMotion, index, introElapsed, profileCompleted]);

  return { index, finished };
}
