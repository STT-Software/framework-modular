import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import { SEQUENCE } from "../sequence";
import { releaseOnFinish } from "../hooks/useSceneMotion";
import { BrandGeometry, animateGeometry } from "./BrandGeometry";

/* ── Geometría del lienzo (viewBox 0 0 640 560) ─────────────────────────────── */

const HUB = { x: 320, y: 280 };
/** Escala del logotipo completo en el cierre (viewBox del logo: 161 × 23). */
const LOCKUP_SCALE = 3.4;
/** Centro de la marca (la N) dentro del viewBox del logo. */
const MARK_CENTER = { x: 11.4, y: 11.5 };
const LOCKUP = { x: HUB.x - (161 / 2) * LOCKUP_SCALE, y: HUB.y - MARK_CENTER.y * LOCKUP_SCALE };
/** Escala de la N dentro del núcleo. */
const HUB_MARK_SCALE = 2.9;

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
const TAGLINE_PATHS = LOGO_PATHS.slice(0, TAGLINE_PATH_COUNT);
const WORD_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** Las tres conversaciones de entrada y la intención que la IA detecta en cada una. */
const TAGS = [
  { label: "Pedido", x: 330, y: 22, w: 112, tone: "orange" },
  { label: "Agendamiento", x: 392, y: 172, w: 172, tone: "cyan" },
  { label: "Reserva", x: 262, y: 300, w: 118, tone: "indigo" },
] as const;

const WAVE = [10, 18, 26, 14, 32, 22, 12, 28, 36, 20, 14, 26, 30, 16, 10, 22, 34, 24, 12, 18, 28, 16, 10, 20];

const CARD = { w: 216, h: 72 };
const MODULES = [
  { label: "Pedidos", meta: "128 hoy", x: 112, y: 104, tone: "paper", icon: "M5 8h14l-1 12H6L5 8Z M9 8V6a3 3 0 0 1 6 0v2" },
  { label: "Agendamiento", meta: "36 citas", x: 112, y: 280, tone: "cyan", icon: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5" },
  { label: "Reservas", meta: "14 mesas", x: 112, y: 456, tone: "indigo", icon: "M7 3h10v18l-5-4-5 4V3Z" },
  { label: "Inventarios", meta: "2.4k ítems", x: 528, y: 104, tone: "indigo", icon: "M3 7l9-4 9 4v10l-9 4-9-4V7Z M3 7l9 4 9-4 M12 11v10" },
  { label: "Turnos", meta: "En fila: 8", x: 528, y: 280, tone: "paper", icon: "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7Z M10 7v10" },
  { label: "Referidos", meta: "+21 nuevos", x: 528, y: 456, tone: "cyan", icon: "M7 17 17 7 M9 7h8v8" },
] as const;

/** Orden de conexión: alterna izquierda y derecha, de arriba abajo. */
const CONNECT_ORDER = [0, 3, 1, 4, 2, 5];

/** Puerto de la tarjeta: el borde que mira al núcleo, donde termina el conector. */
function portX(m: (typeof MODULES)[number]): number {
  return m.x + (m.x < HUB.x ? CARD.w / 2 : -CARD.w / 2);
}

function connectorPath(m: (typeof MODULES)[number]): string {
  const left = m.x < HUB.x;
  const sx = HUB.x + (left ? -70 : 70);
  const ex = m.x + (left ? CARD.w / 2 : -CARD.w / 2);
  const mid = (sx + ex) / 2;
  return `M${sx} ${HUB.y} C${mid} ${HUB.y}, ${mid} ${m.y}, ${ex} ${m.y}`;
}

/* ── Textos por acto ──────────────────────────────────────────────────────── */

type Line = { text: string; accent?: boolean };
const COPY: { kicker?: string; lines: Line[]; lead: string }[] = [
  {
    kicker: "WhatsApp multiformato",
    lines: [{ text: "Un mensaje." }, { text: "Mil formas." }, { text: "Un solo hilo.", accent: true }],
    lead: "Texto, voz e imágenes llegan a la vez, y cada uno cobra sentido.",
  },
  {
    kicker: "Necto IA contextual",
    lines: [{ text: "La IA lee" }, { text: "y enruta cada" }, { text: "intención.", accent: true }],
    lead: "Separa pedidos, citas, reservas y dudas al instante.",
  },
  {
    kicker: "Ecosistema modular",
    lines: [{ text: "Seis motores." }, { text: "Un solo" }, { text: "negocio.", accent: true }],
    lead: "Pedidos, agenda, reservas, inventario, turnos y referidos, conectados.",
  },
  {
    lines: [{ text: "Necto IA." }, { text: "Inteligencia", accent: true }, { text: "en marcha.", accent: true }],
    lead: "Clientes, módulos y decisiones en una sola verdad.",
  },
];

/* ── Línea de tiempo ──────────────────────────────────────────────────────── */

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.83, 0, 0.17, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const BOUNCE = "cubic-bezier(0.34, 1.9, 0.5, 1)";

/** Inicio de cada acto en ms, derivado de `SEQUENCE` para que texto, barra y gráfico vayan juntos. */
const ACT = SEQUENCE.reduce<number[]>((starts, item, i) => [...starts, i === 0 ? 0 : starts[i - 1] + SEQUENCE[i - 1].duration], []);

/*
 * Cortinillas: se mueven con `transform` (lo compone la GPU) y no con `clip-path`, que repinta toda la pantalla
 * en cada fotograma. La capa mide 200vw, está inclinada 20° y entra de izquierda a derecha.
 */
const WIPE_FROM = "translateX(calc(-150vw - 40vh)) skewX(20deg)";
const WIPE_TO = "translateX(0) skewX(20deg)";

interface Timeline {
  animations: Animation[];
  at: (
    target: Element | null | undefined,
    frames: Keyframe[],
    start: number,
    duration: number,
    options?: KeyframeAnimationOptions,
  ) => Animation | undefined;
}

/**
 * Una sola línea de tiempo con la Web Animations API: cada paso se programa con su retraso absoluto.
 * El primer paso que toca una propiedad de un elemento rellena hacia atrás (define el estado inicial);
 * los siguientes solo hacia adelante, para no pisar al anterior mientras esperan.
 */
function createTimeline(): Timeline {
  const animations: Animation[] = [];
  const touched = new WeakMap<Element, Set<string>>();
  return {
    animations,
    at(target, frames, start, duration, options = {}) {
      if (!target) return undefined;
      const props = new Set(frames.flatMap((frame) => Object.keys(frame).filter((k) => k !== "offset" && k !== "easing")));
      const seen = touched.get(target) ?? new Set<string>();
      const fresh = [...props].every((p) => !seen.has(p));
      props.forEach((p) => seen.add(p));
      touched.set(target, seen);
      const animation = target.animate(frames, { delay: start, duration, easing: EASE_OUT, fill: fresh ? "both" : "forwards", ...options });
      animations.push(animation);
      return animation;
    },
  };
}

function buildTimeline(root: HTMLElement, tl: Timeline): void {
  const $ = (selector: string) => root.querySelector(selector);
  const $$ = (selector: string) => Array.from(root.querySelectorAll(selector));
  const { at } = tl;
  const [, a1, a2, a3] = ACT;
  const end = ACT[3] + SEQUENCE[3].duration;

  animateGeometry(root, at, ACT);

  /* Acto 0 · mensajes que llegan */
  at($(".ob-chat"), [{ translate: "0 0" }, { translate: "0 -18px" }], 0, a1 + 2200, { easing: "linear" });
  $$(".ob-bubble").forEach((bubble, i) => {
    const start = 250 + i * 560;
    at(bubble, [{ opacity: 0 }, { opacity: 1 }], start, 220, { easing: "linear" });
    at(bubble, [{ scale: "0.55", translate: "-12px 28px" }, { scale: "1", translate: "0 0" }], start, 820, { easing: SPRING });
  });
  $$(".ob-wave rect").forEach((bar, i) => {
    at(bar, [{ scale: "1 1" }, { scale: `1 ${0.25 + ((i * 37) % 60) / 100}` }], 900 + (i % 5) * 70, 380 + ((i * 53) % 260), {
      iterations: Infinity,
      direction: "alternate",
      easing: "ease-in-out",
    });
  });
  at($(".ob-typing"), [{ opacity: 0, scale: "0.6" }, { opacity: 1, scale: "1" }], 2050, 520, { easing: SPRING });
  $$(".ob-typing rect").forEach((dash, i) => {
    at(dash, [{ translate: "0 0" }, { translate: "0 -5px" }, { translate: "0 0" }], 2300 + i * 140, 700, {
      iterations: Infinity,
      easing: "ease-in-out",
    });
  });
  at($(".ob-typing"), [{ opacity: 1 }, { opacity: 0 }], a1 - 150, 250, { easing: "linear" });

  /* Acto 1 · la IA escanea y etiqueta */
  at($(".ob-scan"), [{ translate: "0 -80px", opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { translate: "0 600px", opacity: 0 }], a1 + 150, 1500, { easing: EASE_IN_OUT });
  $$(".ob-bubble-frame").forEach((frame, i) => {
    at(frame, [{ strokeOpacity: 0 }, { strokeOpacity: 1, offset: 0.3 }, { strokeOpacity: 0.55 }], a1 + 420 + i * 380, 700, { easing: "ease-out" });
  });
  $$(".ob-tag").forEach((tag, i) => {
    const start = a1 + 520 + i * 380;
    at(tag, [{ opacity: 0 }, { opacity: 1 }], start, 160, { easing: "linear" });
    at(tag, [{ scale: "0.3", rotate: "-8deg" }, { scale: "1", rotate: "0deg" }], start, 620, { easing: SPRING });
  });
  $$(".ob-bubble").forEach((bubble, i) => {
    at(bubble, [{ opacity: 1 }, { opacity: 0 }], a1 + 2150 + i * 70, 320, { easing: "linear" });
    at(bubble, [{ scale: "1", translate: "0 0" }, { scale: "0.86", translate: "0 10px" }], a1 + 2150 + i * 70, 420, { easing: EASE_IN });
  });
  at($(".ob-hub"), [{ opacity: 0 }, { opacity: 1 }], a1 + 2300, 200, { easing: "linear" });
  at($(".ob-hub"), [{ scale: "0.2" }, { scale: "1" }], a1 + 2300, 760, { easing: SPRING });
  $$(".ob-tag").forEach((tag, i) => {
    const t = TAGS[i];
    const dx = HUB.x - (t.x + t.w / 2);
    const dy = HUB.y - (t.y + 17) + 18; // +18 compensa la deriva de la conversación
    const start = a1 + 2550 + i * 110;
    at(tag, [{ translate: "0 0" }, { translate: `${dx}px ${dy}px` }], start, 680, { easing: EASE_IN_OUT });
    at(tag, [{ scale: "1" }, { scale: "0.35" }], start, 680, { easing: EASE_IN });
    at(tag, [{ opacity: 1 }, { opacity: 0 }], start + 520, 160, { easing: "linear" });
  });
  at($(".ob-hub"), [{ scale: "1" }, { scale: "1.12" }, { scale: "1" }], a1 + 3300, 520, { easing: "ease-out" });
  at($(".ob-hub-glow"), [{ opacity: 0, scale: "0.8" }, { opacity: 0.9, scale: "1", offset: 0.25 }, { opacity: 0, scale: "1.7" }], a1 + 3300, 900, { easing: "ease-out" });

  /* Acto 2 · el núcleo despliega los seis módulos */
  at($(".ob-wipe-orange"), [{ transform: WIPE_FROM }, { transform: WIPE_TO }], a2, 900, { easing: EASE_IN_OUT });
  at($(".ob-constellation"), [{ scale: "1" }, { scale: "1.04" }], a2, a3 - a2 + 400, { easing: "linear" });
  /*
   * Conexión módulo a módulo, alternando izquierda y derecha: el núcleo toma impulso y emite ondas, la energía
   * recorre el conector (chispa en la punta del trazo) y, al llegar, la tarjeta se acopla con rebote y su puerto se
   * enciende con una onda. Cuando están los seis, los datos fluyen por los conectores.
   */
  at($(".ob-hub"), [{ scale: "1" }, { scale: "0.9", offset: 0.35 }, { scale: "1.08", offset: 0.7 }, { scale: "1" }], a2 + 180, 620, { easing: "ease-in-out" });
  const hubRipples = $$(".ob-hub-ripple");
  const links = $$(".ob-link");
  const sparks = $$(".ob-spark");
  const cards = $$(".ob-card");
  CONNECT_ORDER.forEach((i, k) => {
    const m = MODULES[i];
    const s = a2 + 520 + k * 160;
    if (k % 2 === 0) at(hubRipples[k / 2], [{ opacity: 0.7, scale: "1" }, { opacity: 0, scale: "1.5" }], s, 760, { easing: EASE_OUT });
    at(links[i], [{ opacity: 0 }, { opacity: 1 }], s, 80, { easing: "linear" });
    at(links[i], [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], s, 480, { easing: EASE_OUT });
    at(sparks[i], [{ opacity: 1, strokeDashoffset: 0.05 }, { opacity: 1, strokeDashoffset: -0.95, offset: 0.92 }, { opacity: 0, strokeDashoffset: -1 }], s, 480, { easing: EASE_OUT });
    const card = cards[i];
    const pull = 0.2;
    at(card, [{ opacity: 0 }, { opacity: 1 }], s + 300, 160, { easing: "linear" });
    at(card, [{ translate: `${(HUB.x - m.x) * pull}px ${(HUB.y - m.y) * pull}px`, scale: "0.55" }, { translate: "0 0", scale: "1" }], s + 300, 760, { easing: SPRING });
    at(card.querySelector(".ob-port"), [{ scale: "0" }, { scale: "1" }], s + 430, 560, { easing: BOUNCE });
    at(card.querySelector(".ob-port-ripple"), [{ opacity: 0.9, scale: "1" }, { opacity: 0, scale: "3.4" }], s + 430, 720, { easing: EASE_OUT });
  });
  const flowing = a2 + 520 + CONNECT_ORDER.length * 160 + 500;
  $$(".ob-pulse").forEach((pulse, i) => {
    at(pulse, [{ opacity: 0 }, { opacity: 1 }], flowing, 200, { easing: "linear" });
    at(pulse, [{ strokeDashoffset: 1 }, { strokeDashoffset: -0.2 }], flowing + i * 140, 1100, { iterations: Infinity, easing: "cubic-bezier(0.45, 0, 0.55, 1)" });
  });
  at($(".ob-hub"), [{ scale: "1" }, { scale: "1.05" }, { scale: "1" }], flowing, 1000, { iterations: 2, easing: "ease-in-out" });

  /* Acto 3 · todo vuelve a la N, que se convierte en el logotipo */
  at($(".ob-wipe-navy"), [{ transform: WIPE_FROM }, { transform: WIPE_TO }], a3, 900, { easing: EASE_IN_OUT });
  $$(".ob-pulse").forEach((pulse) => at(pulse, [{ opacity: 1 }, { opacity: 0 }], a3, 200, { easing: "linear" }));
  $$(".ob-link").forEach((link) => {
    at(link, [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }], a3 + 80, 520, { easing: EASE_IN });
    at(link, [{ opacity: 1 }, { opacity: 0 }], a3 + 480, 120, { easing: "linear" });
  });
  $$(".ob-card").forEach((card, i) => {
    const m = MODULES[i];
    const start = a3 + 100 + (MODULES.length - 1 - i) * 45;
    at(card, [{ translate: "0 0", scale: "1" }, { translate: `${HUB.x - m.x}px ${HUB.y - m.y}px`, scale: "0.2" }], start, 560, { easing: EASE_IN });
    at(card, [{ opacity: 1 }, { opacity: 0 }], start + 380, 180, { easing: "linear" });
  });
  const hubSettle = at($(".ob-hub"), [{ scale: "1" }, { scale: "1.1" }, { scale: "1" }], a3 + 640, 420, { easing: "ease-out" });
  at($(".ob-hub-tile"), [{ opacity: 1, scale: "1" }, { opacity: 0, scale: "1.35" }], a3 + 820, 420, { easing: EASE_OUT });
  const markX = LOCKUP.x + MARK_CENTER.x * LOCKUP_SCALE - HUB.x;
  // La N se dibuja al tamaño del logotipo y aquí solo pasa de reducida a su tamaño real: nunca se amplía (no se pixela).
  const markMove = at($(".ob-hub-mark"), [{ translate: "0 0", scale: `${HUB_MARK_SCALE / LOCKUP_SCALE}` }, { translate: `${markX}px 0`, scale: "1" }], a3 + 900, 820, { easing: EASE_IN_OUT });
  // Son las últimas animaciones de la N y su núcleo: al terminar se liberan para que la N se redibuje nítida.
  [hubSettle, markMove].forEach((animation) => animation && releaseOnFinish(animation));
  $$(".ob-lockup-word path").forEach((letter, i) => {
    at(letter, [{ opacity: 0, translate: "0 6px" }, { opacity: 1, translate: "0 0" }], a3 + 1450 + i * 70, 700, { easing: EASE_OUT });
  });
  at($(".ob-lockup-tagline"), [{ opacity: 0, translate: "-4px 0" }, { opacity: 1, translate: "0 0" }], a3 + 1950, 700, { easing: EASE_OUT });
  at($(".ob-lockup-rule"), [{ scale: "0 1" }, { scale: "1 1" }], a3 + 2050, 800, { easing: EASE_IN_OUT });
  at($(".ob-shine"), [{ translate: "-260px 0", opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { translate: "760px 0", opacity: 0 }], a3 + 2250, 1100, { easing: EASE_IN_OUT });
  at($(".ob-finale"), [{ scale: "1" }, { scale: "1.035" }], a3 + 900, end - a3, { easing: "linear" });
}

/* ── Componente ───────────────────────────────────────────────────────────── */

interface LaunchSequenceProps {
  /** Acto activo de `SEQUENCE` (0..3): solo mueve el texto; el gráfico sigue su propia línea de tiempo. */
  sceneIndex: number;
  /** True mientras se espera saber si el perfil ya está completo: la línea de tiempo se congela. */
  holding: boolean;
}

/**
 * Motion graphic continuo de la bienvenida ("Intelligence in motion"): un único lienzo que nunca se desmonta.
 * Mensajes de WhatsApp → la IA los etiqueta → las intenciones entran al núcleo N → el núcleo despliega los
 * seis módulos → todo vuelve a la N, que se convierte en el logotipo de Necto.
 */
export function LaunchSequence({ sceneIndex, holding }: LaunchSequenceProps) {
  const ref = useRef<HTMLElement>(null);
  const timeline = useRef<Animation[]>([]);
  // El primer acto también entra animado: se activa un fotograma después de montar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const activeBeat = mounted ? sceneIndex : -1;

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || typeof root.animate !== "function") return;
    const tl = createTimeline();
    buildTimeline(root, tl);
    timeline.current = tl.animations;
    return () => tl.animations.forEach((animation) => animation.cancel());
  }, []);

  // Congela solo lo que está en marcha y reanuda solo eso: `play()` sobre una animación ya terminada la repetiría.
  const paused = useRef<Animation[]>([]);
  useEffect(() => {
    if (holding) {
      paused.current = timeline.current.filter((animation) => animation.playState === "running");
      paused.current.forEach((animation) => animation.pause());
    } else {
      paused.current.forEach((animation) => animation.play());
      paused.current = [];
    }
  }, [holding]);

  return (
    <section ref={ref} className="ob-launch" data-beat={sceneIndex} aria-label="Presentación de Necto IA">
      <div className="ob-wipe ob-wipe-orange" aria-hidden="true" />
      <div className="ob-wipe ob-wipe-navy" aria-hidden="true" />
      <BrandGeometry />

      <div className="ob-copy-stack">
        {COPY.map((beat, i) => (
          <div
            key={beat.lead}
            className={`ob-copy-beat ${activeBeat === i ? "is-active" : activeBeat > i ? "is-past" : ""}`}
            aria-hidden={sceneIndex !== i}
          >
            {beat.kicker ? (
              <span className="ob-mask">
                <span className="ob-kicker" style={{ "--i": 0 } as CSSProperties}>
                  {beat.kicker}
                </span>
              </span>
            ) : null}
            <h1 className="ob-display-title">
              {beat.lines.map((line, j) => (
                <span key={line.text} className="ob-mask">
                  <span className={line.accent ? "ob-accent-text" : undefined} style={{ "--i": j + 1 } as CSSProperties}>
                    {line.text}
                  </span>
                </span>
              ))}
            </h1>
            <span className="ob-mask">
              <span className="ob-lead" style={{ "--i": beat.lines.length + 1 } as CSSProperties}>
                {beat.lead}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="ob-launch-visual" aria-hidden="true">
        <svg className="ob-hero-svg" viewBox="0 0 640 560" fill="none">
          <defs>
            <linearGradient id="ob-scan-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#97D6DF" stopOpacity="0" />
              <stop offset="1" stopColor="#97D6DF" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="ob-shine-band" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <clipPath id="ob-lockup-glyphs">
              {LOGO_PATHS.map((p) => (
                <path key={p.d.slice(0, 16)} d={p.d} transform={`translate(${LOCKUP.x} ${LOCKUP.y}) scale(${LOCKUP_SCALE})`} />
              ))}
            </clipPath>
          </defs>

          {/* Acto 0-1: conversación entrante */}
          <g className="ob-chat">
            <g className="ob-bubble" style={{ transformOrigin: "24px 160px" }}>
              <rect className="ob-flat-shadow" x="24" y="52" width="380" height="118" rx="24" />
              <rect className="ob-bubble-frame" x="24" y="40" width="380" height="118" rx="24" />
              <path className="ob-bubble-tail" d="M24 132 L10 160 L52 150 Z" />
              <text className="ob-bubble-name" x="50" y="76">Laura · Cliente</text>
              <text className="ob-bubble-text" x="50" y="108">Quiero 2 hamburguesas</text>
              <text className="ob-bubble-text" x="50" y="136">a domicilio, por favor.</text>
              <text className="ob-bubble-time" x="384" y="140" textAnchor="end">9:41</text>
            </g>

            <g className="ob-bubble" style={{ transformOrigin: "120px 272px" }}>
              <rect className="ob-flat-shadow" x="120" y="202" width="400" height="82" rx="24" />
              <rect className="ob-bubble-frame" x="120" y="190" width="400" height="82" rx="24" />
              <rect x="140" y="207" width="48" height="48" rx="14" className="ob-voice-play" />
              <path d="M158 220 L172 231 L158 242 Z" className="ob-voice-icon" />
              <g className="ob-wave">
                {WAVE.map((h, i) => (
                  <rect key={i} x={206 + i * 10} y={231 - h / 2} width="5" height={h} rx="2.5" />
                ))}
              </g>
              <text className="ob-bubble-time" x="500" y="236" textAnchor="end">0:12</text>
            </g>

            <g className="ob-bubble" style={{ transformOrigin: "40px 520px" }}>
              <rect className="ob-flat-shadow" x="40" y="316" width="330" height="216" rx="24" />
              <rect className="ob-bubble-frame" x="40" y="304" width="330" height="216" rx="24" />
              <g>
                <rect x="54" y="318" width="302" height="134" rx="16" className="ob-photo" />
                <path d="M54 420 L140 360 L210 412 L262 378 L356 440 V436 Q356 452 340 452 H70 Q54 452 54 436 Z" className="ob-photo-hill" />
                <path d="M54 452 L180 404 L356 452 Z" className="ob-photo-ground" />
                <rect x="300" y="336" width="34" height="34" rx="8" className="ob-photo-sun" />
              </g>
              <text className="ob-bubble-text" x="62" y="490">¿Mesa para 4 el sábado?</text>
            </g>

            <g className="ob-typing" style={{ transformOrigin: "420px 520px" }}>
              <rect x="420" y="478" width="96" height="42" rx="21" className="ob-typing-bg" />
              <rect x="444" y="496" width="10" height="6" rx="3" />
              <rect x="463" y="496" width="10" height="6" rx="3" />
              <rect x="482" y="496" width="10" height="6" rx="3" />
            </g>

            {TAGS.map((t) => (
              <g key={t.label} className={`ob-tag is-${t.tone}`} style={{ transformOrigin: `${t.x + t.w / 2}px ${t.y + 17}px` }}>
                <rect x={t.x} y={t.y} width={t.w} height="34" rx="10" />
                <path d={`M${t.x + 14} ${t.y + 17} l5 5 l9 -10`} className="ob-tag-check" />
                <text x={t.x + 34} y={t.y + 22.5}>
                  {t.label}
                </text>
              </g>
            ))}
          </g>

          <g className="ob-scan">
            <rect x="0" y="-60" width="640" height="60" fill="url(#ob-scan-band)" />
            <rect x="0" y="-2" width="640" height="3" fill="#97D6DF" />
          </g>

          {/* Acto 2: constelación de módulos */}
          <g className="ob-constellation" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}>
            {MODULES.map((m) => (
              <g key={m.label}>
                <path pathLength={1} d={connectorPath(m)} className="ob-link" />
                <path pathLength={1} d={connectorPath(m)} className="ob-pulse" />
                <path pathLength={1} d={connectorPath(m)} className="ob-spark" />
              </g>
            ))}
            {MODULES.map((m) => (
              <g key={m.label} className={`ob-card is-${m.tone}`} style={{ transformOrigin: `${m.x}px ${m.y}px` }}>
                <rect x={m.x - CARD.w / 2} y={m.y - CARD.h / 2 + 8} width={CARD.w} height={CARD.h} rx="18" className="ob-card-shadow" />
                <rect x={m.x - CARD.w / 2} y={m.y - CARD.h / 2} width={CARD.w} height={CARD.h} rx="18" className="ob-card-bg" />
                <rect x={m.x - CARD.w / 2 + 14} y={m.y - 22} width="44" height="44" rx="12" className="ob-card-icon-bg" />
                <g transform={`translate(${m.x - CARD.w / 2 + 24} ${m.y - 12})`}>
                  <path d={m.icon} className="ob-card-icon" />
                </g>
                <text x={m.x - CARD.w / 2 + 70} y={m.y - 3} className="ob-card-label">
                  {m.label}
                </text>
                <text x={m.x - CARD.w / 2 + 70} y={m.y + 19} className="ob-card-meta">
                  {m.meta}
                </text>
                <circle cx={portX(m)} cy={m.y} r="7" className="ob-port-ripple" style={{ transformOrigin: `${portX(m)}px ${m.y}px` }} />
                <circle cx={portX(m)} cy={m.y} r="7" className="ob-port" style={{ transformOrigin: `${portX(m)}px ${m.y}px` }} />
              </g>
            ))}
          </g>

          {/* Núcleo N: aparece en el acto 1, despliega el 2 y se convierte en la marca del logotipo en el 3 */}
          <g className="ob-hub" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}>
            <rect className="ob-hub-glow" x={HUB.x - 84} y={HUB.y - 84} width="168" height="168" rx="44" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }} />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                className="ob-hub-ripple"
                x={HUB.x - 66}
                y={HUB.y - 66}
                width="132"
                height="132"
                rx="34"
                style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}
              />
            ))}
            <rect className="ob-hub-tile" x={HUB.x - 66} y={HUB.y - 66} width="132" height="132" rx="34" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }} />
            <g className="ob-hub-mark" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}>
              <g transform={`translate(${HUB.x} ${HUB.y}) scale(${LOCKUP_SCALE}) translate(${-MARK_CENTER.x} ${-MARK_CENTER.y})`}>
                {MARK_PATHS.map((p) => (
                  <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
                ))}
              </g>
            </g>
          </g>

          {/* Acto 3: logotipo completo */}
          <g className="ob-finale" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}>
            <g>
              <g transform={`translate(${LOCKUP.x} ${LOCKUP.y}) scale(${LOCKUP_SCALE})`}>
                <g className="ob-lockup-word">
                  {WORD_PATHS.map((p) => (
                    <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
                  ))}
                </g>
                <g className="ob-lockup-tagline">
                  {TAGLINE_PATHS.map((p) => (
                    <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
                  ))}
                </g>
              </g>
            </g>
            <g clipPath="url(#ob-lockup-glyphs)">
              <rect className="ob-shine" x="0" y="150" width="160" height="260" fill="url(#ob-shine-band)" transform="skewX(-22)" />
            </g>
            <rect className="ob-lockup-rule" x={LOCKUP.x} y={HUB.y + 70} width={161 * LOCKUP_SCALE} height="4" rx="2" style={{ transformOrigin: `${LOCKUP.x}px ${HUB.y + 72}px` }} />
          </g>
        </svg>
      </div>
    </section>
  );
}
