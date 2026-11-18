import { useRef, type CSSProperties } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import { GeometryBackdrop } from "../components/GeometryBackdrop";
import { useSceneMotion } from "../hooks/useSceneMotion";
import { ReadyArt } from "./SetupArt";

/*
 * Emblema: la N aparece en su recuadro, el recuadro se abre y de la N brotan las letras y el lema hasta formar el
 * logotipo completo ("necto grow together"), que es lo que queda. Lienzo de 300 × 96; el logotipo (viewBox 161 × 23)
 * ocupa todo el ancho. La N se dibuja centrada a escala MARK_SCALE (la marca de 60 px) y al expandirse solo se reduce
 * hasta la escala del logotipo: nunca se amplía (no se pixela).
 */
const CREST = { w: 300, h: 96 };
const LOGO_SCALE = CREST.w / 161;
const LOGO_Y = (CREST.h - 23 * LOGO_SCALE) / 2;
const MARK_CENTER = { x: 11.4, y: 11.5 };
const MARK_SCALE = 2.5;
/** Desplazamiento de la N desde el centro hasta su sitio en el logotipo. */
const MARK_LOGO_X = MARK_CENTER.x * LOGO_SCALE - CREST.w / 2;
const TAGLINE_PATHS = LOGO_PATHS.slice(0, TAGLINE_PATH_COUNT);
const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
const WORD_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.83, 0, 0.17, 1)";
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";

interface ReadySceneProps {
  onContinue: () => void;
}

/** Pantalla final plana en 2D (cierre del onboarding): "Comencemos juntos" lleva al workspace. */
export function ReadyScene({ onContinue }: ReadySceneProps) {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(
    ref,
    (root, motion) => {
      motion(
        root.querySelector(".ob-ready-dissolve"),
        [
          { transform: "translateX(0) skewX(20deg)" },
          { transform: "translateX(calc(100vw + 40vh)) skewX(20deg)" },
        ],
        { duration: 900, easing: "cubic-bezier(0.83, 0, 0.17, 1)" },
      );

      // La N aparece en su recuadro con rebote y se sostiene; el recuadro se abre, la N viaja a su sitio en el
      // logotipo y de ella brotan las letras (de la primera a la última) y después el lema.
      motion(root.querySelector(".ob-ready-tile"), [{ opacity: 0, scale: "0.4" }, { opacity: 1, scale: "1" }], {
        delay: 320,
        duration: 700,
        easing: SPRING,
      });
      motion(root.querySelector(".ob-ready-mark"), [{ opacity: 0 }, { opacity: 1 }], { delay: 420, duration: 400 });
      motion(
        root.querySelector(".ob-ready-tile"),
        [
          { opacity: 1, scale: "1" },
          { opacity: 0, scale: "1.35" },
        ],
        { delay: 1400, duration: 450, easing: EASE_OUT },
      );
      motion(
        root.querySelector(".ob-ready-mark"),
        [
          { translate: "0 0", scale: "1" },
          { translate: `${MARK_LOGO_X}px 0`, scale: `${LOGO_SCALE / MARK_SCALE}` },
        ],
        { delay: 1450, duration: 800, easing: EASE_IN_OUT },
      );
      const letters = Array.from(root.querySelectorAll<SVGGraphicsElement>(".ob-ready-word path"));
      // Read every box first, then start the animations, so layout is never forced between writes.
      const offsets = letters.map((letter) => {
        const box = letter.getBBox();
        return MARK_CENTER.x - (box.x + box.width / 2);
      });
      letters.forEach((letter, i) => {
        const dx = offsets[i];
        motion(
          letter,
          [
            { opacity: 0, translate: `${dx}px 0`, scale: "0.4" },
            { opacity: 1, translate: "0 0", scale: "1" },
          ],
          { delay: 1900 + i * 60, duration: 560, easing: EASE_OUT },
        );
      });
      motion(
        root.querySelector(".ob-ready-tagline"),
        [
          { opacity: 0, translate: "-14px 0" },
          { opacity: 1, translate: "0 0" },
        ],
        { delay: 2350, duration: 520, easing: EASE_OUT },
      );

      motion(
        root.querySelector(".ob-ready-slash"),
        [
          { opacity: 0, transform: "scaleX(0)" },
          { opacity: 1, transform: "scaleX(1)" },
        ],
        { delay: 2600, duration: 640 },
      );
    },
    { delay: 2500, step: 80, distance: 14 },
  );

  return (
    <section ref={ref} className="ob-scene ob-scene-ready" aria-labelledby="ob-ready-title">
      <GeometryBackdrop />
      <div className="ob-ready-dissolve" aria-hidden="true" />
      <div className="ob-ready-crest" aria-hidden="true">
        {/* What the person just completed arrives around the logo once it has formed */}
        <ReadyArt />
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
            <g
              className="ob-ready-mark"
              style={
                {
                  transformOrigin: `${CREST.w / 2}px ${CREST.h / 2}px`,
                  "--mark-x": `${MARK_LOGO_X}px`,
                  "--mark-scale": `${LOGO_SCALE / MARK_SCALE}`,
                } as CSSProperties
              }
            >
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
      <h1 id="ob-ready-title" data-reveal>
        Todo listo.
        <br />
        <em>Crezcamos juntos.</em>
      </h1>
      <button type="button" className="ob-continue" data-reveal onClick={onContinue}>
        Comencemos juntos <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
