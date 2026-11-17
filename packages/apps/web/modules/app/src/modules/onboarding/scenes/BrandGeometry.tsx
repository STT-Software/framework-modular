/*
 * Geometría de marca a pantalla completa para la secuencia de bienvenida.
 *
 * Lenguaje (tomado de los aros del login y del motivo de la barra lateral del workspace, no del logotipo):
 * pocas primitivas planas de trazo grueso, cortadas por los bordes, asimétricas y con mucho aire; un solo acento de
 * color por acto. Cada acto suma formas que cuentan su parte de la historia:
 *   0 · mensajes  → onda de voz y los tres puntos de "escribiendo".
 *   1 · la IA lee → un arco que barre como un radar y un signo +.
 *   2 · módulos   → un cuadrado redondeado (un módulo) que releva a la cápsula y un cuarto de círculo en la esquina.
 *   3 · cierre    → el cuadrado se vuelve círculo (todo converge) y entran barras con el ángulo de la diagonal de la N.
 * Las piezas persisten entre actos y se recomponen; cada una se mueve con su propio peso (lo grande, lento; lo
 * pequeño, con rebote). Todas pintan con `currentColor`, así que cambiar de fondo es animar `color`.
 * Solo se animan transform, opacidad y color (más un `border-radius` puntual).
 */

export type GeometryAt = (
  target: Element | null | undefined,
  frames: Keyframe[],
  start: number,
  duration: number,
  options?: KeyframeAnimationOptions,
) => Animation | undefined;

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.83, 0, 0.17, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const BOUNCE = "cubic-bezier(0.34, 1.9, 0.5, 1)";

/** Blanco rebajado sobre naranja (como el panel naranja del login) y sobre el marino del cierre. */
const ON_ORANGE = "rgba(255, 255, 255, 0.16)";
const ON_ORANGE_ACCENT = "rgba(255, 255, 255, 0.36)";
const ON_NAVY = "rgba(255, 255, 255, 0.1)";
const ACCENT = "#ff3f1a";
const INDIGO = "#190088";

export function BrandGeometry() {
  return (
    <div className="ob-geo" aria-hidden="true">
      <i className="ob-geo-ring-a" />
      <i className="ob-geo-ring-b" />
      <i className="ob-geo-capsule" />
      <i className="ob-geo-square" />
      <i className="ob-geo-quarter" />
      <i className="ob-geo-arc" />
      <svg className="ob-geo-wave" viewBox="0 0 120 30" fill="none">
        <path pathLength={1} d="M6 15 C14 3 24 3 32 15 S50 27 58 15 S76 3 84 15 S102 27 114 15" />
      </svg>
      <i className="ob-geo-dots">
        <b />
        <b />
        <b />
      </i>
      <i className="ob-geo-plus">
        <b />
        <b />
      </i>
      <i className="ob-geo-slashes">
        <b />
        <b />
        <b />
      </i>
      <i className="ob-geo-disc" />
      <i className="ob-geo-dot" />
    </div>
  );
}

/** Programa la geometría en la línea de tiempo de la secuencia; `acts` son los inicios de cada acto en ms. */
export function animateGeometry(root: HTMLElement, at: GeometryAt, acts: number[], lite = false): void {
  const $ = (selector: string) => root.querySelector(selector);
  const $$ = (selector: string) => Array.from(root.querySelectorAll(selector));
  const [, a1, a2, a3] = acts;

  const ringA = $(".ob-geo-ring-a");
  const ringB = $(".ob-geo-ring-b");
  const capsule = $(".ob-geo-capsule");
  const square = $(".ob-geo-square");
  const quarter = $(".ob-geo-quarter");
  const arc = $(".ob-geo-arc");
  const wave = $(".ob-geo-wave");
  const wavePath = $(".ob-geo-wave path");
  const dots = $(".ob-geo-dots");
  const plus = $(".ob-geo-plus");
  const slashes = $(".ob-geo-slashes");
  const disc = $(".ob-geo-disc");
  const sat = $(".ob-geo-dot");

  /* Acto 0 · se arma la composición: el aro grande, lento; la cápsula sube del borde; la onda de voz se dibuja; el
     disco se acopla con rebote; el satélite cae al final y los tres puntos "escriben". */
  at(ringA, [{ opacity: 0 }, { opacity: 1 }], 0, 700, { easing: "linear" });
  at(ringA, [{ scale: "0.82", translate: "0 0" }, { scale: "1", translate: "0 0" }], 0, 1800, { easing: EASE_OUT });
  at(capsule, [{ opacity: 0 }, { opacity: 1 }], 250, 500, { easing: "linear" });
  at(capsule, [{ translate: "0 16vmin", rotate: "-40deg" }, { translate: "0 0", rotate: "-25deg" }], 250, 1500, { easing: EASE_OUT });
  at(ringB, [{ opacity: 0 }, { opacity: 1 }], 500, 600, { easing: "linear" });
  at(ringB, [{ scale: "0.6" }, { scale: "1" }], 500, 1400, { easing: EASE_OUT });
  at(wave, [{ opacity: 0 }, { opacity: 1 }], 700, 120, { easing: "linear" });
  at(wavePath, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 700, 1300, { easing: EASE_OUT });
  at(disc, [{ scale: "0" }, { scale: "1" }], 1050, 850, { easing: SPRING });
  at(sat, [{ opacity: 0 }, { opacity: 1 }], 1400, 140, { easing: "linear" });
  at(sat, [{ translate: "0 -7vmin", scale: "0.4" }, { translate: "0 0", scale: "1" }], 1400, 820, { easing: BOUNCE });
  at(dots, [{ opacity: 0, translate: "0 3vmin" }, { opacity: 1, translate: "0 0" }], 1900, 700, { easing: EASE_OUT });
  // Los puntos "escriben" hasta que se van en el acto 1 (nada queda en bucle); en equipos modestos, quietos.
  if (!lite) {
    $$(".ob-geo-dots b").forEach((bead, i) => {
      const start = 2200 + i * 160;
      at(bead, [{ translate: "0 0" }, { translate: "0 -1.3vmin" }], start, 420, {
        iterations: Math.max(1, (a1 + 500 - start) / 420),
        direction: "alternate",
        easing: "ease-in-out",
      });
    });
  }

  /* Acto 1 · la IA lee: la onda y los puntos se van (ya se leyeron), un arco barre como un radar y entra un +. */
  at(wavePath, [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }], a1 + 100, 800, { easing: EASE_IN });
  at(wave, [{ opacity: 1 }, { opacity: 0 }], a1 + 760, 140, { easing: "linear" });
  at(dots, [{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: "0 2vmin" }], a1 + 100, 400, { easing: EASE_IN });
  at(arc, [{ opacity: 0 }, { opacity: 1 }], a1 + 100, 400, { easing: "linear" });
  at(arc, [{ rotate: "-160deg" }, { rotate: "-25deg" }], a1 + 100, 1500, { easing: EASE_OUT });
  at(arc, [{ rotate: "-25deg" }, { rotate: "95deg" }], a1 + 1600, 2100, { easing: EASE_IN_OUT });
  at(plus, [{ opacity: 0 }, { opacity: 1 }], a1 + 1000, 160, { easing: "linear" });
  at(plus, [{ rotate: "-135deg", scale: "0.3" }, { rotate: "0deg", scale: "1" }], a1 + 1000, 900, { easing: SPRING });
  at(ringA, [{ scale: "1", translate: "0 0" }, { scale: "1.08", translate: "5vmin 3vmin" }], a1, 3900, { easing: EASE_IN_OUT });
  at(sat, [{ translate: "0 0" }, { translate: "-9vmin 8vmin" }], a1 + 500, 900, { easing: EASE_IN_OUT });
  at(disc, [{ translate: "0 0" }, { translate: "4vmin -3vmin" }], a1 + 700, 1100, { easing: SPRING });

  /* Acto 2 · módulos, sobre naranja: todo pasa a blanco rebajado; el aro pequeño crece como acento; la cápsula sale
     por el borde y un cuadrado redondeado (un módulo) entra en su lugar; un cuarto de círculo crece en la esquina. */
  at(arc, [{ opacity: 1 }, { opacity: 0 }], a2 + 150, 300, { easing: "linear" });
  [ringA, capsule, plus].forEach((shape) => at(shape, [{ color: ON_ORANGE }], a2 + 300, 400, { easing: "linear" }));
  at(ringB, [{ color: ON_ORANGE_ACCENT }], a2 + 300, 400, { easing: "linear" });
  at(ringB, [{ scale: "1" }, { scale: "1.45" }], a2 + 200, 1600, { easing: EASE_OUT });
  at(plus, [{ rotate: "0deg" }, { rotate: "90deg" }], a2 + 500, 1200, { easing: EASE_IN_OUT });
  at(capsule, [{ translate: "0 0", rotate: "-25deg" }, { translate: "-4vmin 22vmin", rotate: "-10deg" }], a2 + 250, 900, { easing: EASE_IN });
  at(square, [{ opacity: 0 }, { opacity: 1 }], a2 + 700, 200, { easing: "linear" });
  at(square, [{ rotate: "-80deg", scale: "0.4" }, { rotate: "-25deg", scale: "1" }], a2 + 700, 1200, { easing: SPRING });
  at(quarter, [{ scale: "0" }, { scale: "1" }], a2 + 450, 1300, { easing: EASE_OUT });
  at(sat, [{ color: INDIGO }], a2 + 300, 400, { easing: "linear" });
  at(sat, [{ translate: "-9vmin 8vmin" }, { translate: "6vmin 3vmin" }], a2 + 600, 1000, { easing: EASE_IN_OUT });

  /* Acto 3 · cierre, sobre marino: el aro pequeño toma el naranja de acento (como el panel índigo del login); el
     cuadrado se vuelve círculo (los módulos convergen); entran barras con el ángulo de la diagonal de la N. */
  [ringA, square].forEach((shape) => at(shape, [{ color: ON_NAVY }], a3 + 300, 500, { easing: "linear" }));
  at(ringB, [{ color: ACCENT }], a3 + 300, 500, { easing: "linear" });
  at(ringB, [{ scale: "1.45" }, { scale: "1.2" }], a3 + 200, 1400, { easing: EASE_IN_OUT });
  at(square, [{ borderRadius: "28%" }, { borderRadius: "50%" }], a3 + 250, 1000, { easing: EASE_IN_OUT });
  at(square, [{ rotate: "-25deg", scale: "1" }, { rotate: "65deg", scale: "1.3" }], a3 + 250, 1400, { easing: EASE_IN_OUT });
  at(quarter, [{ scale: "1" }, { scale: "0" }], a3 + 150, 600, { easing: EASE_IN });
  at(plus, [{ opacity: 1 }, { opacity: 0 }], a3 + 150, 300, { easing: "linear" });
  at(plus, [{ rotate: "90deg", scale: "1" }, { rotate: "180deg", scale: "0.4" }], a3 + 150, 400, { easing: EASE_IN });
  at(disc, [{ scale: "1" }, { scale: "0" }], a3 + 150, 420, { easing: EASE_IN });
  at(sat, [{ opacity: 1 }, { opacity: 0 }], a3 + 200, 300, { easing: "linear" });
  at(slashes, [{ opacity: 0, translate: "-24vmin 0" }, { opacity: 1, translate: "0 0" }], a3 + 1300, 1200, { easing: EASE_OUT });
  $$(".ob-geo-slashes b").forEach((bar, i) => {
    at(bar, [{ scale: "1 0" }, { scale: "1 1" }], a3 + 1350 + i * 110, 800, { easing: EASE_OUT });
  });
}
