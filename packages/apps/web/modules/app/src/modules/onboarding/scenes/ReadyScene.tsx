import { useRef } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { useSceneMotion } from "../hooks/useSceneMotion";

interface ReadySceneProps {
  onContinue: () => void;
}

/** Pantalla final: invita a seguir con el botón "Comenzar". */
export function ReadyScene({ onContinue }: ReadySceneProps) {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(
    ref,
    (root, motion) => {
      motion(
        root.querySelector(".ob-ready-emblem"),
        [
          { opacity: 0, transform: "scale(.75) rotate(-12deg)" },
          { opacity: 1, transform: "scale(1) rotate(0deg)" },
        ],
        { duration: 850 },
      );
    },
    { delay: 100, step: 75, distance: 14 },
  );

  return (
    <section ref={ref} className="ob-scene ob-scene-ready" aria-labelledby="ob-ready-title">
      <div className="ob-ready-emblem" aria-hidden="true">
        <span />
        <div>
          <NectoLogo variant="mark" width={64} height={64} />
        </div>
      </div>
      <span className="ob-kicker" data-reveal>
        ESTE ES TU COMIENZO
      </span>
      <h1 id="ob-ready-title" data-reveal>
        Qué bueno que
        <br />
        <em>estés aquí.</em>
      </h1>
      <p data-reveal>Tu próxima conexión te espera.</p>
      <button type="button" className="ob-continue" data-reveal onClick={onContinue}>
        Comenzar <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
