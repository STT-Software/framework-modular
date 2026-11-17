import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { LOGO_PATHS, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import { isLowPowerDevice } from "../hooks/motionBudget";
import { prefersReducedMotion } from "../hooks/useReducedMotion";
import { createTimeline, EASE_OUT } from "../hooks/timeline";

/*
 * Pantalla de carga hacia el workspace · «El cruce».
 *
 * Cuenta el lema de la marca en tres tiempos (manual de naming: «Nos cruzamos, nos unimos, crecemos»; NECTO viene del
 * latín *nectere*, «atar, enlazar, unir»), con la imagen de la campaña: un paso de cebra visto desde arriba.
 *   1 · Nos cruzamos → una cortinilla marina entra en diagonal y franjas crema, con el ángulo de la diagonal de la N,
 *       llegan desde arriba y desde abajo, se cruzan y forman un paso de cebra.
 *   2 · Nos unimos   → el paso se cierra hacia el centro y de ahí sale la N; la esquina de la marca llega volando y se
 *       acopla (el nudo), y el acople resuena en ondas (movimiento y resonancia).
 *   3 · Crecemos     → una barra crece mientras el workspace se descarga de verdad en segundo plano.
 *   Salida           → una cortinilla del color del workspace lo cubre todo y se entra al workspace sin corte.
 *
 * Rendimiento: solo se animan `transform` y `opacity` de elementos HTML (la GPU los compone, nada se repinta), nada
 * queda en bucle salvo un brillo pequeño en la barra si la descarga tarda, y todo dura unos 4 s. Con movimiento
 * reducido no hay animación: se ve la marca quieta y se entra en cuanto el workspace está listo.
 */

const EASE_IN_OUT = "cubic-bezier(0.83, 0, 0.17, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";

const MARK_LEG = LOGO_PATHS[TAGLINE_PATH_COUNT];
const MARK_CORNER = LOGO_PATHS[TAGLINE_PATH_COUNT + 1];

/** Franjas del paso de cebra; la quinta es el acento naranja. */
const STRIPES = 8;
const ACCENT_STRIPE = 5;

const WORDS = ["Nos cruzamos.", "Nos unimos.", "Crecemos."] as const;
/** Inicio (ms) de cada tiempo de la historia. */
const BEAT = [250, 1350, 2150] as const;
/** Mínimo en pantalla antes de salir, aunque el workspace ya esté listo: la historia se cuenta entera. */
const MIN_MS = 2950;
/** Si la descarga no responde, se entra igual (la ruta la vuelve a pedir). */
const MAX_WAIT_MS = 8000;

const WIPE_FROM = "translateX(calc(-100vw - 40vh)) skewX(20deg)";
const WIPE_TO = "translateX(0) skewX(20deg)";

interface WorkspaceLoaderProps {
  /** Descarga lo que necesita el workspace; la pantalla sale cuando termina (o a los 8 s). */
  load: () => Promise<unknown>;
  /** La cortinilla ya tapa la pantalla anterior: se puede desmontar lo de debajo. */
  onCovered: () => void;
  /** La salida terminó y la pantalla está del color del workspace: es el momento de navegar. */
  onDone: () => void;
}

export function WorkspaceLoader({ load, onCovered, onDone }: WorkspaceLoaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Siempre las últimas versiones, sin reiniciar la animación.
  const callbacks = useRef({ load, onCovered, onDone });
  callbacks.current = { load, onCovered, onDone };

  // Antes del primer pintado: así nunca se ve un fotograma sin los estados iniciales de la animación.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const $ = (selector: string) => root.querySelector(selector);
    const $$ = (selector: string) => Array.from(root.querySelectorAll(selector));
    let cancelled = false;
    const timers: number[] = [];
    const extra: Animation[] = [];

    const ready = Promise.race([
      callbacks.current.load().catch(() => undefined),
      new Promise((resolve) => timers.push(window.setTimeout(resolve, MAX_WAIT_MS))),
    ]);

    if (prefersReducedMotion() || typeof root.animate !== "function") {
      root.classList.add("is-static");
      callbacks.current.onCovered();
      const minimum = new Promise((resolve) => timers.push(window.setTimeout(resolve, 500)));
      void Promise.all([ready, minimum]).then(() => {
        if (!cancelled) callbacks.current.onDone();
      });
      return () => {
        cancelled = true;
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    }

    const lite = isLowPowerDevice();
    const tl = createTimeline();
    const { at } = tl;

    /* Entrada · la cortinilla marina tapa la pantalla final */
    const curtain = at($(".ob-loader-curtain"), [{ transform: WIPE_FROM }, { transform: WIPE_TO }], 0, 720, { easing: EASE_IN_OUT });
    curtain?.finished.then(
      () => !cancelled && callbacks.current.onCovered(),
      () => undefined,
    );

    /* 1 · Nos cruzamos: las franjas llegan desde arriba y desde abajo, alternadas, y se cruzan */
    $$(".ob-loader-stripe").forEach((stripe, i) => {
      const fromTop = i % 2 === 0;
      const start = BEAT[0] + 120 + i * 55;
      at(stripe, [{ opacity: 0 }, { opacity: 1 }], start, 160, { easing: "linear" });
      at(stripe, [{ translate: `0 ${fromTop ? -70 : 70}vh` }, { translate: "0 0" }], start, 900, { easing: EASE_OUT });
    });

    /* 2 · Nos unimos: el paso se cierra hacia el centro, de afuera hacia adentro, y sale la N */
    $$(".ob-loader-stripe").forEach((stripe, i) => {
      const fromCenter = i - (STRIPES - 1) / 2;
      const order = Math.abs(fromCenter);
      // Las de los extremos se cierran primero. Cada franja viaja hasta el centro: su paso es 2.6 anchos (ancho + hueco).
      const start = BEAT[1] + 160 + ((STRIPES - 1) / 2 - order) * 45;
      at(stripe, [{ translate: "0 0" }, { translate: `${-fromCenter * 260}% 0` }], start, 520, { easing: EASE_IN });
      at(stripe, [{ scale: "1 1" }, { scale: "0.4 0.25" }], start, 520, { easing: EASE_IN });
      at(stripe, [{ opacity: 1 }, { opacity: 0 }], start + 380, 140, { easing: "linear" });
    });
    const legIn = BEAT[1] + 620;
    at($(".ob-loader-leg"), [{ opacity: 0 }, { opacity: 1 }], legIn, 140, { easing: "linear" });
    at($(".ob-loader-leg"), [{ scale: "0.35" }, { scale: "1" }], legIn, 700, { easing: SPRING });
    // La esquina llega girando desde arriba a la derecha y se acopla: el nudo de *nectere*.
    const dock = legIn + 380;
    at($(".ob-loader-corner"), [{ opacity: 0 }, { opacity: 1 }], legIn + 80, 160, { easing: "linear" });
    at(
      $(".ob-loader-corner"),
      [
        { translate: "120% -160%", rotate: "-120deg", scale: "0.6" },
        { translate: "0 0", rotate: "0deg", scale: "1" },
      ],
      legIn + 80,
      dock - legIn - 80 + 120,
      { easing: EASE_OUT },
    );
    at($(".ob-loader-mark"), [{ scale: "1" }, { scale: "1.08" }, { scale: "1" }], dock + 60, 420, { easing: "ease-out" });
    $$(".ob-loader-echo").forEach((echo, i) => {
      // Solo hacia adelante: mientras espera, manda el `opacity: 0` del CSS (si rellenara hacia atrás, el aro se vería
      // desde el primer fotograma).
      at(echo, [{ opacity: 0.7, scale: "0.8" }, { opacity: 0, scale: "2.3" }], dock + 60 + i * 200, 900, { easing: EASE_OUT, fill: "forwards" });
    });

    /* Texto: un tiempo por línea, que entra por una máscara y sale hacia arriba al llegar la siguiente */
    $$(".ob-loader-word").forEach((word, i) => {
      at(word, [{ translate: "0 110%" }, { translate: "0 0" }], BEAT[i], 640, { easing: EASE_OUT });
      if (i < WORDS.length - 1) at(word, [{ translate: "0 0" }, { translate: "0 -110%" }], BEAT[i + 1] - 260, 360, { easing: EASE_IN });
    });

    /* 3 · Crecemos: la barra crece y aparece el estado */
    at($(".ob-loader-progress"), [{ opacity: 0 }, { opacity: 1 }], BEAT[2], 300, { easing: "linear" });
    at($(".ob-loader-fill"), [{ scale: "0 1" }, { scale: "0.82 1" }], BEAT[2], MIN_MS - BEAT[2], { easing: EASE_OUT });
    at($(".ob-loader-caption"), [{ opacity: 0, translate: "0 6px" }, { opacity: 1, translate: "0 0" }], BEAT[2] + 150, 500, { easing: EASE_OUT });

    // Si al cumplirse el mínimo el workspace aún no está, un brillo recorre la barra mientras espera.
    let loaded = false;
    void ready.then(() => {
      loaded = true;
    });
    timers.push(
      window.setTimeout(() => {
        if (cancelled || loaded || lite) return;
        const glint = $(".ob-loader-glint");
        if (glint) {
          extra.push(glint.animate([{ translate: "-100% 0" }, { translate: "400% 0" }], { duration: 1100, iterations: Infinity, easing: "ease-in-out" }));
        }
      }, MIN_MS),
    );

    /* Salida · la barra se completa, todo sube y se va, y una cortinilla del color del workspace lo cubre */
    const minimum = new Promise((resolve) => timers.push(window.setTimeout(resolve, MIN_MS)));
    void Promise.all([ready, minimum]).then(() => {
      if (cancelled) return;
      extra.forEach((animation) => animation.cancel());
      const play = (selector: string, frames: Keyframe[], options: KeyframeAnimationOptions) => {
        const animation = $(selector)?.animate(frames, { fill: "forwards", ...options });
        if (animation) extra.push(animation);
        return animation;
      };
      play(".ob-loader-fill", [{ scale: "0.82 1" }, { scale: "1 1" }], { duration: 320, easing: EASE_OUT });
      play(".ob-loader-center", [{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: "0 -14px" }], { delay: 220, duration: 420, easing: EASE_IN });
      const wipe = play(".ob-loader-exit", [{ transform: WIPE_FROM }, { transform: WIPE_TO }], { delay: 380, duration: 720, easing: EASE_IN_OUT });
      if (!wipe) {
        callbacks.current.onDone();
        return;
      }
      wipe.finished.then(
        () => !cancelled && callbacks.current.onDone(),
        () => undefined,
      );
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      tl.animations.forEach((animation) => animation.cancel());
      extra.forEach((animation) => animation.cancel());
    };
  }, []);

  return (
    <div ref={ref} className="ob-loader" role="status" aria-live="polite">
      <span className="ob-sr-only">Preparando tu workspace…</span>
      <div className="ob-loader-curtain" aria-hidden="true" />
      <div className="ob-loader-stage" aria-hidden="true">
        <div className="ob-loader-center">
          <div className="ob-loader-cross">
            {Array.from({ length: STRIPES }, (_, i) => (
              <i key={i} className={`ob-loader-stripe${i === ACCENT_STRIPE ? " is-accent" : ""}`} />
            ))}
          </div>
          <div className="ob-loader-mark">
            <i className="ob-loader-echo" />
            <i className="ob-loader-echo" />
            <svg className="ob-loader-leg" viewBox="0 0 23 23" fill="none">
              <path d={MARK_LEG.d} fill={MARK_LEG.fill} />
            </svg>
            <svg className="ob-loader-corner" viewBox="0 0 23 23" fill="none">
              <path d={MARK_CORNER.d} />
            </svg>
          </div>
          <div className="ob-loader-text">
            <span className="ob-loader-words">
              {WORDS.map((word, i) => (
                <span key={word} className={`ob-loader-word${i === WORDS.length - 1 ? " is-accent" : ""}`} style={{ "--i": i } as CSSProperties}>
                  {word}
                </span>
              ))}
            </span>
            <span className="ob-loader-progress">
              <i className="ob-loader-fill" />
              <i className="ob-loader-glint" />
            </span>
            <span className="ob-loader-caption">Preparando tu workspace</span>
          </div>
        </div>
      </div>
      <div className="ob-loader-exit" aria-hidden="true" />
    </div>
  );
}
