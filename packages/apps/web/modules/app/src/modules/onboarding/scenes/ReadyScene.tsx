import { useRef } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import { GeometryPlayground } from "../components/GeometryPlayground";
import { useSceneMotion } from "../hooks/useSceneMotion";

/*
 * Emblema: el logotipo completo ("necto grow together") se contrae hasta quedar solo la N dentro de su recuadro.
 * Lienzo de 300 × 96; el logotipo (viewBox 161 × 23) ocupa todo el ancho y la N termina centrada a escala MARK_SCALE
 * (la misma que la marca de 60 px). La N se dibuja a su tamaño final y empieza reducida: nunca se amplía (no se pixela).
 */
const CREST = { w: 300, h: 96 };
const LOGO_SCALE = CREST.w / 161;
const LOGO_Y = (CREST.h - 23 * LOGO_SCALE) / 2;
const MARK_CENTER = { x: 11.4, y: 11.5 };
const MARK_SCALE = 2.5;
const MARK_START_X = MARK_CENTER.x * LOGO_SCALE - CREST.w / 2;
const TAGLINE_PATHS = LOGO_PATHS.slice(0, TAGLINE_PATH_COUNT);
const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
const WORD_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";
const EASE_IN_OUT = "cubic-bezier(0.83, 0, 0.17, 1)";
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";

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

      // El logotipo completo aparece, se sostiene y se contrae: el lema y las letras se recogen hacia la N (de la
      // última a la primera), la N viaja al centro y crece hasta su tamaño, y el recuadro la envuelve con rebote.
      motion(
        root.querySelector(".ob-ready-logo"),
        [
          { opacity: 0, translate: "0 12px" },
          { opacity: 1, translate: "0 0" },
        ],
        { delay: 320, duration: 700 },
      );
      motion(
        root.querySelector(".ob-ready-tagline"),
        [
          { opacity: 1, translate: "0 0" },
          { opacity: 0, translate: "-14px 0" },
        ],
        { delay: 1250, duration: 380, easing: EASE_IN },
      );
      const letters = Array.from(root.querySelectorAll<SVGGraphicsElement>(".ob-ready-word path"));
      letters.forEach((letter, i) => {
        const box = letter.getBBox();
        const dx = MARK_CENTER.x - (box.x + box.width / 2);
        motion(
          letter,
          [
            { opacity: 1, translate: "0 0", scale: "1" },
            { opacity: 0, translate: `${dx}px 0`, scale: "0.4" },
          ],
          { delay: 1320 + (letters.length - 1 - i) * 55, duration: 460, easing: EASE_IN },
        );
      });
      motion(
        root.querySelector(".ob-ready-mark"),
        [
          { translate: `${MARK_START_X}px 0`, scale: `${LOGO_SCALE / MARK_SCALE}` },
          { translate: "0 0", scale: "1" },
        ],
        { delay: 1700, duration: 820, easing: EASE_IN_OUT },
      );
      motion(
        root.querySelector(".ob-ready-tile"),
        [
          { opacity: 0, scale: "0.4" },
          { opacity: 1, scale: "1" },
        ],
        { delay: 2200, duration: 700, easing: SPRING },
      );

      motion(
        root.querySelector(".ob-ready-slash"),
        [
          { opacity: 0, transform: "scaleX(0)" },
          { opacity: 1, transform: "scaleX(1)" },
        ],
        { delay: 2450, duration: 640 },
      );
    },
    { delay: 2300, step: 80, distance: 14 },
  );

  return (
    <section ref={ref} className="ob-scene ob-scene-ready" aria-labelledby="ob-ready-title">
      <GeometryPlayground />
      <div className="ob-ready-dissolve" aria-hidden="true" />
      <div className="ob-ready-crest" aria-hidden="true">
        <svg className="ob-ready-emblem" width={CREST.w} height={CREST.h} viewBox={`0 0 ${CREST.w} ${CREST.h}`} fill="none">
          <rect
            className="ob-ready-tile"
            x={CREST.w / 2 - 48}
            y={CREST.h / 2 - 48}
            width="96"
            height="96"
            rx="24"
            style={{ transformOrigin: `${CREST.w / 2}px ${CREST.h / 2}px` }}
          />
          <g className="ob-ready-logo">
            <g transform={`translate(0 ${LOGO_Y}) scale(${LOGO_SCALE})`}>
              <g className="ob-ready-word">
                {WORD_PATHS.map((p) => (
                  <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
                ))}
              </g>
              <g className="ob-ready-tagline">
                {TAGLINE_PATHS.map((p) => (
                  <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
                ))}
              </g>
            </g>
            <g className="ob-ready-mark" style={{ transformOrigin: `${CREST.w / 2}px ${CREST.h / 2}px` }}>
              <g
                transform={`translate(${CREST.w / 2} ${CREST.h / 2}) scale(${MARK_SCALE}) translate(${-MARK_CENTER.x} ${-MARK_CENTER.y})`}
              >
                {MARK_PATHS.map((p) => (
                  <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
                ))}
              </g>
            </g>
          </g>
        </svg>
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
