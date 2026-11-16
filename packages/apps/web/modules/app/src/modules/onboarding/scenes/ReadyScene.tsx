import { useRef } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { useSceneMotion } from "../hooks/useSceneMotion";

interface ReadySceneProps {
  onContinue: () => void;
}

/** Pantalla final plana en 2D: invita a continuar hacia la configuración con "Comenzar". */
export function ReadyScene({ onContinue }: ReadySceneProps) {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(
    ref,
    (root, motion) => {
      motion(
        root.querySelector(".ob-ready-dissolve"),
        [
          { transform: "translateX(0) skewX(20deg)" },
          { transform: "translateX(calc(150vw + 5vh)) skewX(20deg)" },
        ],
        { duration: 900, easing: "cubic-bezier(0.83, 0, 0.17, 1)" },
      );

      motion(
        root.querySelector(".ob-ready-crest"),
        [
          { opacity: 0, transform: "translateY(18px) scale(0.84)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { delay: 380, duration: 700 },
      );

      motion(
        root.querySelector(".ob-ready-slash"),
        [
          { opacity: 0, transform: "scaleX(0)" },
          { opacity: 1, transform: "scaleX(1)" },
        ],
        { delay: 540, duration: 640 },
      );
    },
    { delay: 440, step: 75, distance: 14 },
  );

  return (
    <section ref={ref} className="ob-scene ob-scene-ready" aria-labelledby="ob-ready-title">
      <div className="ob-ready-dissolve" aria-hidden="true" />
      <div className="ob-ready-crest" aria-hidden="true">
        <div className="ob-ready-badge">
          <NectoLogo variant="mark" width={60} height={60} />
        </div>
        <span className="ob-ready-slash" />
      </div>
      <span className="ob-kicker" data-reveal>
        ESTE ES TU COMIENZO
      </span>
      <h1 id="ob-ready-title" data-reveal>
        Qué bueno que
        <br />
        <em>estés aquí.</em>
      </h1>
      <p data-reveal>Tu plataforma modular con Necto IA te espera.</p>
      <button type="button" className="ob-continue" data-reveal onClick={onContinue}>
        Comenzar <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
