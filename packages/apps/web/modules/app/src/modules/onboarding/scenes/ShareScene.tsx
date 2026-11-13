import { useRef } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { useSceneMotion } from "../hooks/useSceneMotion";

/** Cada tarjeta: selector, desplazamiento horizontal final (px) y giro final (grados). */
const CARDS: ReadonlyArray<readonly [selector: string, x: number, rotation: number]> = [
  [".ob-card-left", -125, -14],
  [".ob-card-right", 125, 14],
  [".ob-card-front", 0, -3],
];

/** Escena 2 (Comparte): tres tarjetas se abren en abanico. */
export function ShareScene() {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(ref, (root, motion) => {
    CARDS.forEach(([selector, x, rotation], i) =>
      motion(
        root.querySelector(selector),
        [
          { opacity: 0, transform: "translate(-50%,-35%) rotate(0deg) scale(.75)" },
          { opacity: 1, transform: `translate(calc(-50% + ${x}px),-50%) rotate(${rotation}deg) scale(1)` },
        ],
        { delay: 100 + i * 100, duration: 950 },
      ),
    );
  });

  return (
    <section ref={ref} className="ob-scene" aria-labelledby="ob-share-heading">
      <div className="ob-graphic ob-cards" aria-hidden="true">
        <div className="ob-motion-card ob-card-left">
          <span className="ob-card-mini">IDEAS</span>
          <div className="ob-card-flower">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="ob-card-line" />
          <span className="ob-card-line short" />
        </div>
        <div className="ob-motion-card ob-card-right">
          <span className="ob-card-mini">COMUNIDAD</span>
          <div className="ob-card-bubbles">
            <i />
            <i />
            <i />
          </div>
          <span className="ob-card-line" />
          <span className="ob-card-line short" />
        </div>
        <div className="ob-motion-card ob-card-front">
          <span className="ob-card-mini">LO QUE TE MUEVE</span>
          <div className="ob-card-mark">
            <NectoLogo variant="mark" width={64} height={64} />
          </div>
          <span className="ob-card-line" />
          <span className="ob-card-line short" />
          <span className="ob-card-star">✦</span>
        </div>
      </div>
      <div className="ob-scene-copy">
        <span className="ob-kicker" data-reveal>
          02 / COMPARTE
        </span>
        <h1 id="ob-share-heading" data-reveal>
          Tus ideas, <em>más lejos.</em>
        </h1>
        <p data-reveal>Comparte lo que sabes. Descubre lo que viene.</p>
      </div>
    </section>
  );
}
