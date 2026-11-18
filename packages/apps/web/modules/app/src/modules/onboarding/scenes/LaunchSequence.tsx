import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import { SEQUENCE } from "../sequence";
import { isLowPowerDevice } from "../hooks/motionBudget";
import { createTimeline, type Timeline } from "../hooks/timeline";
import { releaseOnFinish } from "../hooks/useSceneMotion";
import { BrandGeometry, animateGeometry } from "./BrandGeometry";
import { ArtCheckBadge, ArtMark, ArtOrbits, ArtSpark, Pop } from "./artPrimitives";

/*
 * Welcome intro art: four static editorial vector compositions, one per act of `SEQUENCE`, with the visual language
 * of RegisterScenes (/super/register) and BrandScenes (/business/access): flat geometry, rounded cards (border 1.3),
 * icon strokes 1.5 with round caps, the Necto mark where it adds meaning, no heavy gradients, no people. Colors only
 * through the `ob-art-*` classes in onboarding.css, whose variables follow the background of each act and the theme.
 * The shared primitives live in artPrimitives.tsx.
 */

/**
 * The dotted circle of `ArtOrbits`, drawn in its own HTML layer right behind the scene SVG (same 460 × 350 box, same
 * center). It turns slowly while its act is on screen: as a separate layer the GPU rotates it without repainting the
 * illustration on every frame, which is what a rotation inside the SVG would cost.
 */
function ArtOrbitRing() {
  return (
    <svg className="ob-art-orbit-layer" viewBox="0 0 460 350" fill="none" aria-hidden="true">
      <circle className="ob-art-orbit" cx="230" cy="174" r="132" />
    </svg>
  );
}

/* ── Act 0 · logo: one incoming conversation, three formats ─────────────────────── */

/*
 * A slightly tilted chat card holds the three incoming messages: a text bubble, a voice note (play button, static
 * wave bars, 0:12) and a photo message (cake on a table) asking for a table and a cake. Satellites: microphone,
 * image and message tokens joined to the card by dotted links.
 */
const CHAT_WAVE = [6, 11, 16, 9, 18, 13, 7, 15, 19, 10, 14, 8, 12, 6];

function ConversationArt() {
  return (
    <svg className="ob-scene-art" viewBox="0 0 460 350" fill="none">
      <ArtOrbits />
      {/* Satellites → card: the data flows into the conversation */}
      <path
        className="ob-art-link ob-flow-dots"
        strokeDasharray="1 4"
        d="M104 124Q126 138 146 140M360 132Q340 140 322 146M358 246Q340 240 322 232"
      />
      <ArtSpark cx={150} cy={34} size={13} />
      <ArtSpark cx={404} cy={186} size={10} />
      <ArtSpark cx={58} cy={236} size={11} />
      <ellipse className="ob-art-shadow" cx="232" cy="304" rx="118" ry="10" />

      <Pop order={0}>
        <g transform="rotate(-4 230 168)">
          <rect className="ob-art-card" x="138" y="50" width="184" height="236" rx="16" />
          {/* Header: chat tile + contact */}
          <rect className="ob-art-orange-tint" x="150" y="62" width="26" height="26" rx="8" />
          <path className="ob-art-icon-accent" d="M156 69h14v9h-8l-4 3.5V78h-2Z" />
          <text className="ob-art-label" x="184" y="72" fontSize="6">
            WHATSAPP
          </text>
          <text className="ob-art-text" x="184" y="84" fontSize="9">
            Laura · Cliente
          </text>
          {/* Online: the dot breathes and sends a soft ring */}
          <circle className="ob-art-cyan ob-pulse-ring" cx="306" cy="74" r="3" />
          <circle className="ob-art-cyan ob-pulse-dot" cx="306" cy="74" r="3" />
          <path className="ob-art-rule" d="M150 98H310" />

          <Pop order={1}>
            {/* 1 · text */}
            <rect className="ob-art-soft" x="150" y="106" width="150" height="34" rx="10" />
            <text className="ob-art-text" x="158" y="120" fontSize="8">
              Quiero 2 hamburguesas
            </text>
            <text className="ob-art-text" x="158" y="132" fontSize="8">
              a domicilio
            </text>
          </Pop>
          <Pop order={2}>
            {/* 2 · voice note */}
            <rect className="ob-art-soft" x="150" y="148" width="160" height="32" rx="10" />
            {/* Playing: the button pulses and the wave bars move */}
            <g className="ob-play-pulse">
              <circle className="ob-art-orange" cx="166" cy="164" r="10" />
              <path className="ob-art-on-accent" d="M163 159l7.5 5-7.5 5Z" />
            </g>
            {CHAT_WAVE.map((h, i) => (
              <rect
                key={i}
                className="ob-art-ink ob-wave-bar"
                style={{ "--i": i } as CSSProperties}
                x={184 + i * 6.4}
                y={164 - h / 2}
                width="2.6"
                height={h}
                rx="1.3"
              />
            ))}
            <text className="ob-art-text" x="302" y="167" fontSize="7" textAnchor="end">
              0:12
            </text>
          </Pop>
          <Pop order={3}>
            {/* 3 · photo + text */}
            <rect className="ob-art-soft" x="150" y="188" width="160" height="88" rx="10" />
            <rect className="ob-art-cyan" x="158" y="196" width="144" height="50" rx="7" />
            <circle className="ob-art-on-accent" cx="284" cy="208" r="5" />
            <rect className="ob-art-ink" x="192" y="231" width="76" height="5" rx="2.5" />
            <path className="ob-art-icon" d="M200 236v10M260 236v10" />
            <rect className="ob-art-orange" x="216" y="215" width="28" height="16" rx="4" />
            <path className="ob-art-on-accent" d="M216 221h28v2.5h-28Z" />
            <rect className="ob-art-ink" x="229" y="207" width="2" height="8" rx="1" />
            <circle className="ob-art-orange" cx="230" cy="204.5" r="2" />
            <text className="ob-art-text" x="158" y="264" fontSize="8">
              ¿Mesa para 4 y un pastel?
            </text>
          </Pop>
        </g>
      </Pop>
      <Pop order={4}>
        <ArtCheckBadge cx={316} cy={46} r={9} />
      </Pop>

      {/* Satellite: microphone */}
      <Pop order={2}>
        <g className="ob-float" style={{ "--d": 0 } as CSSProperties}>
          <g transform="translate(78 110) rotate(-12)">
            <rect className="ob-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
            <rect className="ob-art-icon-accent" x="-4" y="-12" width="8" height="14" rx="4" />
            <path className="ob-art-icon-accent" d="M-8-2a8 8 0 0 0 16 0M0 6v5M-4 11h8" />
          </g>
        </g>
      </Pop>

      {/* Satellite: image */}
      <Pop order={3}>
        <g className="ob-float" style={{ "--d": 1 } as CSSProperties}>
          <g transform="translate(386 120) rotate(9)">
            <rect className="ob-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
            <rect className="ob-art-icon" x="-11" y="-9" width="22" height="18" rx="3.5" />
            <circle className="ob-art-icon" cx="5" cy="-3" r="2" />
            <path className="ob-art-icon" d="M-11 6l7-6 5 4 4-3 6 5" />
          </g>
        </g>
      </Pop>

      {/* Satellite: message */}
      <Pop order={4}>
        <g className="ob-float" style={{ "--d": 2 } as CSSProperties}>
          <g transform="translate(384 256) rotate(-8)">
            <rect className="ob-art-card" x="-28" y="-28" width="56" height="56" rx="18" />
            <path className="ob-art-icon" d="M-11-9h22v14h-12l-6 5v-5h-4Z" />
            {/* Typing… */}
            {[-5, 0, 5].map((dx, i) => (
              <circle
                key={dx}
                className="ob-art-ink ob-typing-dot"
                style={{ "--i": i } as CSSProperties}
                cx={dx}
                cy="-2"
                r="1.4"
              />
            ))}
          </g>
        </g>
      </Pop>

      <circle className="ob-art-cyan-halo ob-halo-pulse" cx="98" cy="270" r="11.5" />
      <circle className="ob-art-cyan" cx="98" cy="270" r="5.5" />
    </svg>
  );
}

/* ── Act 1 · connect: Necto IA reads and routes each intention ──────────────────── */

/*
 * The three read messages (left) feed the Necto IA engine card (center, the mark as protagonist). Classified intent
 * pills leave it on the right: Pedido (orange), Agendamiento (cyan) and, from the same photo message, Reserva and
 * Pedido at once. Satellite: a magnifier token reading on top of the engine.
 */
interface IntentMessage {
  x: number;
  y: number;
  angle: number;
  label: string;
  text: string;
  glyph: string;
}

const INTENT_MESSAGES: IntentMessage[] = [
  { x: 26, y: 58, angle: -5, label: "TEXTO", text: "2 hamburguesas", glyph: "M-5-3h10M-5 0h10M-5 3h6" },
  { x: 20, y: 152, angle: 2, label: "NOTA DE VOZ", text: "Cita el viernes", glyph: "M-2.5-4l6 4-6 4Z" },
  {
    x: 26,
    y: 246,
    angle: 4,
    label: "FOTO",
    text: "Mesa y pastel",
    glyph: "M-5.5-4h11v8h-11ZM-5.5 2.5l3.5-3 3 2.5 2-1.5 3 2.5",
  },
];

interface IntentPill {
  x: number;
  y: number;
  w: number;
  label: string;
  tone: "orange" | "cyan" | "ink";
}

/*
 * Each pill is fired from the engine edge along its line once the engine has read its message (`at`, seconds after
 * the scene activates): the text, then the voice note, then the photo, which fires Reserva and Pedido together.
 */
const INTENT_PILLS: (IntentPill & { line: string; at: number })[] = [
  { x: 318, y: 66, w: 82, label: "Pedido", tone: "orange", line: "M290 132Q300 88 318 80", at: 2.05 },
  { x: 308, y: 152, w: 118, label: "Agendamiento", tone: "cyan", line: "M290 166H308", at: 2.45 },
  { x: 316, y: 222, w: 86, label: "Reserva", tone: "ink", line: "M290 206Q298 230 316 234", at: 2.85 },
  { x: 336, y: 256, w: 82, label: "Pedido", tone: "orange", line: "M290 210Q302 266 336 268", at: 2.95 },
];
/** Where the pills are fired from: the right edge of the engine card. */
const ENGINE_EDGE = { x: 290, y: 172 };

const PILL_CLASS = {
  orange: { bg: "ob-art-orange", text: "ob-art-on-accent", check: "ob-art-check-light" },
  cyan: { bg: "ob-art-cyan", text: "ob-art-on-cyan", check: "ob-art-check" },
  ink: { bg: "ob-art-ink", text: "ob-art-on-ink", check: "ob-art-check-ink" },
} as const;

function IntentArt() {
  return (
    <svg className="ob-scene-art" viewBox="0 0 460 350" fill="none">
      <ArtOrbits />
      {/* Messages → engine, engine → intents, magnifier → engine */}
      <path
        className="ob-art-link ob-flow-dots"
        style={{ "--d": "1.1s" } as CSSProperties}
        strokeDasharray="1 4"
        d="M140 76Q160 104 172 138M134 168H172M140 262Q160 236 172 210M230 74V98"
      />
      {/* Engine → intents: each line is traced, then its data keeps flowing */}
      {INTENT_PILLS.map((p, i) => (
        <g key={i} style={{ "--d": `${p.at - 0.3}s`, "--f": `${p.at + 0.15}s` } as CSSProperties}>
          <path className="ob-art-link ob-trace" pathLength={1} d={p.line} />
          <path className="ob-art-link ob-flow-dash" strokeDasharray="4 4" d={p.line} />
        </g>
      ))}
      <ArtSpark cx={162} cy={34} size={12} />
      <ArtSpark cx={432} cy={112} size={10} />
      <ArtSpark cx={196} cy={300} size={11} />
      <ellipse className="ob-art-shadow" cx="230" cy="304" rx="118" ry="10" />

      {INTENT_MESSAGES.map((m, i) => (
        <Pop key={m.label} order={i}>
          <g transform={`rotate(${m.angle} ${m.x + 57} ${m.y + 17})`}>
            <rect className="ob-art-card" x={m.x} y={m.y} width="114" height="34" rx="11" />
            <rect className="ob-art-soft" x={m.x + 7} y={m.y + 7} width="20" height="20" rx="6" />
            <path className="ob-art-icon" transform={`translate(${m.x + 17} ${m.y + 17})`} d={m.glyph} />
            <text className="ob-art-label" x={m.x + 34} y={m.y + 14} fontSize="5.5">
              {m.label}
            </text>
            <text className="ob-art-text" x={m.x + 34} y={m.y + 26} fontSize="8">
              {m.text}
            </text>
          </g>
        </Pop>
      ))}

      {/* Necto IA engine */}
      <Pop order={3}>
        <g transform="rotate(-3 230 172)">
          <rect className="ob-art-card" x="170" y="98" width="120" height="150" rx="18" />
          <rect className="ob-art-orange-tint" x="204" y="112" width="52" height="52" rx="16" />
          <g className="ob-mark-beat">
            <ArtMark x={214} y={122} size={32} />
          </g>
          <text className="ob-art-label" x="230" y="182" fontSize="6" textAnchor="middle">
            NECTO IA
          </text>
          <text className="ob-art-text" x="230" y="196" fontSize="9" textAnchor="middle">
            Leyendo intención
          </text>
          <rect className="ob-art-soft" x="186" y="208" width="88" height="5" rx="2.5" />
          <rect className="ob-art-orange ob-progress-fill" x="186" y="208" width="88" height="5" rx="2.5" />
          <text className="ob-art-label" x="230" y="230" fontSize="5.5" textAnchor="middle">
            4 INTENCIONES
          </text>
        </g>
        <ArtCheckBadge cx={286} cy={100} r={9} />
      </Pop>

      {INTENT_PILLS.map((p, i) => {
        const tone = PILL_CLASS[p.tone];
        return (
          <g
            key={i}
            className="ob-pill-shot"
            style={
              {
                "--d": `${p.at}s`,
                "--fx": `${ENGINE_EDGE.x - p.x}px`,
                "--fy": `${ENGINE_EDGE.y - (p.y + 12)}px`,
                transformOrigin: `${p.x + p.w / 2}px ${p.y + 12}px`,
              } as CSSProperties
            }
          >
            <rect className={tone.bg} x={p.x} y={p.y} width={p.w} height="24" rx="12" />
            <path
              className={`${tone.check} ob-check-draw`}
              pathLength={1}
              transform={`translate(${p.x + 14} ${p.y + 12}) scale(0.8)`}
              d="m-4.5 0 3 3 6-6.2"
            />
            <text className={tone.text} x={p.x + 25} y={p.y + 15.5} fontSize="8.5" fontWeight="600">
              {p.label}
            </text>
          </g>
        );
      })}
      <Pop order={17}>
        <text className="ob-art-label" x="318" y="298" fontSize="5.5">
          1 MENSAJE · 2 MÓDULOS
        </text>
      </Pop>

      {/* Satellite: magnifier reading the messages */}
      <Pop order={3}>
        <g className="ob-scan">
          <g transform="translate(230 48) rotate(-8)">
            <rect className="ob-art-card" x="-26" y="-26" width="52" height="52" rx="17" />
            <circle className="ob-art-icon" cx="-3" cy="-3" r="7.5" />
            <path className="ob-art-icon-accent" d="M2.5 2.5l7 7" />
          </g>
        </g>
      </Pop>

      <circle className="ob-art-cyan-halo" cx="72" cy="218" r="11.5" />
      <circle className="ob-art-cyan" cx="72" cy="218" r="5.5" />
    </svg>
  );
}

/* ── Act 2 · share: six engines, one business (over the orange wipe) ────────────── */

/*
 * The Necto hub sits in the center; six module cards (three per side) plug into it through their active port.
 * Each card: line glyph, name, metric and a cyan check.
 */
interface ModuleCard {
  name: string;
  meta: string;
  glyph: string;
  x: number;
  y: number;
  angle: number;
}

const MODULE_W = 128;
const MODULE_H = 50;

// Glyphs drawn around (0, 0) in a 16-unit box.
const MODULE_GLYPH = {
  bag: "M-6-2.5h12l-1 8.5h-10Z M-3-2.5v-1.5a3 3 0 0 1 6 0v1.5",
  calendar:
    "M-5-5.5h10a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-10a2.5 2.5 0 0 1-2.5-2.5v-8a2.5 2.5 0 0 1 2.5-2.5Z M-7.5-1.5h15 M-3-7.5v3 M3-7.5v3",
  bookmark: "M-4.5-6.5h9v13l-4.5-3.6-4.5 3.6Z",
  box: "M-6.5-3 0-6.5 6.5-3v6.5L0 7l-6.5-3.5Z M-6.5-3 0 .5 6.5-3 M0 .5V7",
  ticket: "M-7-4.5h14v3a1.5 1.5 0 0 0 0 3v3h-14v-3a1.5 1.5 0 0 0 0-3Z M-1.5-4.5v9",
  referral: "M-5.5 5.5 5.5-5.5 M-1-5.5h6.5V1",
};

const MODULE_CARDS: ModuleCard[] = [
  { name: "Pedidos", meta: "128 hoy", glyph: MODULE_GLYPH.bag, x: 18, y: 42, angle: -3 },
  { name: "Agendamiento", meta: "36 citas", glyph: MODULE_GLYPH.calendar, x: 12, y: 150, angle: 2 },
  { name: "Reservas", meta: "14 mesas", glyph: MODULE_GLYPH.bookmark, x: 18, y: 258, angle: -2 },
  { name: "Inventarios", meta: "2.4k ítems", glyph: MODULE_GLYPH.box, x: 314, y: 42, angle: 3 },
  { name: "Turnos", meta: "En fila: 8", glyph: MODULE_GLYPH.ticket, x: 320, y: 150, angle: -2 },
  { name: "Referidos", meta: "+21 nuevos", glyph: MODULE_GLYPH.referral, x: 314, y: 258, angle: 2 },
];

const HUB_CENTER = { x: 230, y: 175 };
/** Entry order of each card (after the hub): alternates left and right, top to bottom. */
const MODULE_ORDER = [1, 3, 5, 2, 4, 6];
/** Seconds after the scene activates: the hub lands, then sends one connector every `MODULE_STEP`. */
const MODULE_START = 1.05;
const MODULE_STEP = 0.24;
/** A connector takes this long to reach its port; the card docks right then. */
const MODULE_TRACE = 0.42;
/** Once the six cards are docked, data keeps flowing along every connector. */
const MODULE_FLOW = MODULE_START + 5 * MODULE_STEP + MODULE_TRACE + 0.2;
const moduleAt = (i: number) => MODULE_START + (MODULE_ORDER[i] - 1) * MODULE_STEP;

function ModulesArt() {
  return (
    <svg className="ob-scene-art" viewBox="0 0 460 350" fill="none">
      <ArtOrbits />
      <ArtSpark cx={230} cy={44} size={14} />
      <ArtSpark cx={190} cy={102} size={9} />
      <ArtSpark cx={272} cy={254} size={10} />
      <ellipse className="ob-art-shadow" cx="230" cy="330" rx="150" ry="10" />

      {/* Connectors: hub → each card port */}
      {MODULE_CARDS.map((m, i) => {
        const left = m.x < HUB_CENTER.x;
        const sx = HUB_CENTER.x + (left ? -36 : 36);
        const ex = left ? m.x + MODULE_W : m.x;
        const ey = m.y + MODULE_H / 2;
        const mid = (sx + ex) / 2;
        const d = `M${sx} ${HUB_CENTER.y}C${mid} ${HUB_CENTER.y} ${mid} ${ey} ${ex} ${ey}`;
        return (
          <g key={m.name} style={{ "--d": `${moduleAt(i)}s`, "--f": `${MODULE_FLOW}s` } as CSSProperties}>
            <path className="ob-art-link ob-trace" pathLength={1} d={d} />
            <path className="ob-art-link ob-flow-dash" strokeDasharray="4 4" d={d} />
          </g>
        );
      })}

      {MODULE_CARDS.map((m, i) => {
        const left = m.x < HUB_CENTER.x;
        const portX = left ? m.x + MODULE_W : m.x;
        const cy = m.y + MODULE_H / 2;
        return (
          <g
            key={m.name}
            className="ob-card-dock"
            style={
              {
                "--d": `${moduleAt(i) + MODULE_TRACE}s`,
                "--fx": `${(HUB_CENTER.x - (m.x + MODULE_W / 2)) * 0.22}px`,
                "--fy": `${(HUB_CENTER.y - cy) * 0.22}px`,
                transformOrigin: `${m.x + MODULE_W / 2}px ${cy}px`,
              } as CSSProperties
            }
          >
            <g transform={`rotate(${m.angle} ${m.x + MODULE_W / 2} ${cy})`}>
              <rect className="ob-art-card" x={m.x} y={m.y} width={MODULE_W} height={MODULE_H} rx="14" />
              <rect className="ob-art-orange-tint" x={m.x + 11} y={m.y + 11} width="28" height="28" rx="9" />
              <path
                className="ob-art-icon-accent"
                transform={`translate(${m.x + 25} ${m.y + 25}) scale(.9)`}
                d={m.glyph}
              />
              <text className="ob-art-text" x={m.x + 47} y={m.y + 22} fontSize="9">
                {m.name}
              </text>
              <text className="ob-art-label" x={m.x + 47} y={m.y + 35} fontSize="6">
                {m.meta.toUpperCase()}
              </text>
              {/* Active port facing the hub */}
              <circle className="ob-art-card" cx={portX} cy={cy} r="5" />
              <circle className="ob-art-cyan" cx={portX} cy={cy} r="2.4" />
              <circle className="ob-port-flash" cx={portX} cy={cy} r="4" />
              <g className="ob-badge-pop">
                <ArtCheckBadge cx={left ? m.x + 4 : m.x + MODULE_W - 4} cy={m.y + 3} r={6} />
              </g>
            </g>
          </g>
        );
      })}

      {/* Necto hub */}
      <Pop order={0}>
        {/* Energy ring: the hub pulses as it sends each pair of connectors */}
        <rect
          className="ob-hub-ring"
          style={{ "--d": `${MODULE_START}s` } as CSSProperties}
          x="194"
          y="139"
          width="72"
          height="72"
          rx="20"
        />
        <rect className="ob-art-card" x="194" y="139" width="72" height="72" rx="20" />
        <ArtMark x={213} y={158} size={34} />
        <ArtCheckBadge cx={264} cy={141} r={8} />
        <text className="ob-art-label" x="230" y="230" fontSize="6" textAnchor="middle">
          6 MÓDULOS
        </text>
      </Pop>
    </svg>
  );
}

/* ── Act 3 · grow: the Necto mark becomes the full logo (over the indigo wipe) ─── */

/*
 * The closing keeps the original logo animation: the N sits in its tile at the center, the tile opens and the N
 * slides to its place in the full logo while the letters cascade in, then the tagline, the orange rule and a shine
 * clipped to the letters. The motion is scheduled in `buildTimeline` (act 3), so it runs once, in sync with the wipe.
 */
const FINALE_HUB = { x: 230, y: 175 };
/** Scale of the full logo (logo viewBox 161 × 23). */
const FINALE_SCALE = 2.4;
/** Center of the mark (the N) inside the logo viewBox. */
const FINALE_MARK_CENTER = { x: 11.4, y: 11.5 };
const FINALE_LOCKUP = {
  x: FINALE_HUB.x - (161 / 2) * FINALE_SCALE,
  y: FINALE_HUB.y - FINALE_MARK_CENTER.y * FINALE_SCALE,
};
/** Scale of the N inside its tile before it opens. */
const FINALE_TILE_MARK_SCALE = 2.05;
const FINALE_TILE = 94;

const FINALE_MARK = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
const FINALE_TAGLINE = LOGO_PATHS.slice(0, TAGLINE_PATH_COUNT);
const FINALE_WORD = LOGO_PATHS.slice(TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

function FinaleArt() {
  const { x: hx, y: hy } = FINALE_HUB;
  const lockup = `translate(${FINALE_LOCKUP.x} ${FINALE_LOCKUP.y}) scale(${FINALE_SCALE})`;
  return (
    <svg className="ob-scene-art" viewBox="0 0 460 350" fill="none">
      <defs>
        <linearGradient id="ob-finale-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ob-finale-glyphs">
          {LOGO_PATHS.map((p) => (
            <path key={p.d.slice(0, 16)} d={p.d} transform={lockup} />
          ))}
        </clipPath>
      </defs>

      {/* Tile + N: the N is drawn at logo size and only scaled down here, so it never upsamples. */}
      <g className="ob-finale-hub" style={{ transformOrigin: `${hx}px ${hy}px` }}>
        <rect
          className="ob-finale-tile"
          x={hx - FINALE_TILE / 2}
          y={hy - FINALE_TILE / 2}
          width={FINALE_TILE}
          height={FINALE_TILE}
          rx="24"
          style={{ transformOrigin: `${hx}px ${hy}px` }}
        />
        <g className="ob-finale-mark" style={{ transformOrigin: `${hx}px ${hy}px` }}>
          <g
            transform={`translate(${hx} ${hy}) scale(${FINALE_SCALE}) translate(${-FINALE_MARK_CENTER.x} ${-FINALE_MARK_CENTER.y})`}
          >
            {FINALE_MARK.map((p) => (
              <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
            ))}
          </g>
        </g>
      </g>

      <g transform={lockup}>
        <g className="ob-finale-word">
          {FINALE_WORD.map((p) => (
            <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
          ))}
        </g>
        <g className="ob-finale-tagline">
          {FINALE_TAGLINE.map((p) => (
            <path key={p.d.slice(0, 16)} d={p.d} fill={p.fill} />
          ))}
        </g>
      </g>
      <g clipPath="url(#ob-finale-glyphs)">
        <rect
          className="ob-finale-shine"
          x="0"
          y={hy - 92}
          width="113"
          height="184"
          fill="url(#ob-finale-shine)"
          transform="skewX(-22)"
        />
      </g>
      <rect
        className="ob-finale-rule"
        x={FINALE_LOCKUP.x}
        y={hy + 50}
        width={161 * FINALE_SCALE}
        height="3"
        rx="1.5"
        style={{ transformOrigin: `${FINALE_LOCKUP.x}px ${hy + 51.5}px` }}
      />
    </svg>
  );
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
    lead: "Si un mensaje pide dos cosas, cada una llega a su módulo al instante.",
  },
  {
    kicker: "Ecosistema modular",
    lines: [{ text: "Seis motores." }, { text: "Un solo" }, { text: "negocio.", accent: true }],
    lead: "Pedidos, agenda, reservas, inventario, turnos y referidos, conectados.",
  },
  {
    // Lema de la marca (manual de naming): "Nos cruzamos, nos unimos, crecemos." junto a "grow together".
    lines: [{ text: "Nos cruzamos." }, { text: "Nos unimos." }, { text: "Crecemos.", accent: true }],
    lead: "Clientes, módulos y decisiones en una sola verdad.",
  },
];

/** Art of each act, in `SEQUENCE` order. */
const ACT_ART = [ConversationArt, IntentArt, ModulesArt, FinaleArt];
/** Acts whose art sits on the orbit pair (the finale draws only the logo). */
const ACT_HAS_ORBITS = [true, true, true, false];
/*
 * The art never depends on props or state, so its elements are created once: when the act changes React sees the
 * same elements and skips the hundreds of SVG nodes instead of reconciling all four trees on every beat (that work
 * landed exactly on the act change, next to the wipe).
 */
const ACT_SCENES = ACT_ART.map((Art, i) => (
  <>
    {ACT_HAS_ORBITS[i] ? <ArtOrbitRing /> : null}
    <Art />
  </>
));

/* ── Línea de tiempo (solo fondo: cortinillas y geometría de marca) ───────── */

const EASE_IN_OUT = "cubic-bezier(0.83, 0, 0.17, 1)";

/** Inicio de cada acto en ms, derivado de `SEQUENCE` para que texto, barra y fondo vayan juntos. */
const ACT = SEQUENCE.reduce<number[]>(
  (starts, item, i) => [...starts, i === 0 ? 0 : starts[i - 1] + SEQUENCE[i - 1].duration],
  [],
);

/*
 * Cortinillas: se mueven con `transform` (lo compone la GPU) y no con `clip-path`, que repinta toda la pantalla
 * en cada fotograma. La capa mide lo justo para cubrir la pantalla inclinada 20° (100vw + 40vh, ver el CSS) y entra
 * de izquierda a derecha.
 */
const WIPE_FROM = "translateX(calc(-100vw - 40vh)) skewX(20deg)";
const WIPE_TO = "translateX(0) skewX(20deg)";

function buildTimeline(root: HTMLElement, tl: Timeline, lite: boolean): void {
  const { at } = tl;
  const [, , a2, a3] = ACT;
  animateGeometry(root, at, ACT, lite);
  at(root.querySelector(".ob-wipe-orange"), [{ transform: WIPE_FROM }, { transform: WIPE_TO }], a2, 900, {
    easing: EASE_IN_OUT,
  });
  at(root.querySelector(".ob-wipe-navy"), [{ transform: WIPE_FROM }, { transform: WIPE_TO }], a3, 900, {
    easing: EASE_IN_OUT,
  });
  // Con el marino ya cubriendo, la cortinilla naranja queda debajo sin verse: se oculta para que la GPU no la dibuje.
  at(root.querySelector(".ob-wipe-orange"), [{ visibility: "visible" }, { visibility: "hidden" }], a3 + 900, 1, {
    easing: "linear",
  });
  buildFinale(root, tl, a3, lite);
}

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";

/*
 * Cierre (acto 3): la animación del logotipo de siempre. La escena entra con el texto (~0.6 s); la N llega con
 * rebote en su recuadro, el recuadro se abre y la N se desplaza a su sitio mientras entran las letras en cascada,
 * el lema, el subrayado naranja y un brillo recortado a las letras (que se omite en equipos modestos).
 */
function buildFinale(root: HTMLElement, { at }: Timeline, a3: number, lite: boolean): void {
  const $ = (selector: string) => root.querySelector(selector);
  const start = a3 + 620;
  at($(".ob-finale-hub"), [{ scale: "0.6" }, { scale: "1" }], start, 700, { easing: SPRING });
  at(
    $(".ob-finale-tile"),
    [
      { opacity: 1, scale: "1" },
      { opacity: 0, scale: "1.35" },
    ],
    start + 430,
    420,
    { easing: EASE_OUT },
  );
  const markX = FINALE_LOCKUP.x + FINALE_MARK_CENTER.x * FINALE_SCALE - FINALE_HUB.x;
  const markMove = at(
    $(".ob-finale-mark"),
    [
      { translate: "0 0", scale: `${FINALE_TILE_MARK_SCALE / FINALE_SCALE}` },
      { translate: `${markX}px 0`, scale: "1" },
    ],
    start + 480,
    820,
    { easing: EASE_IN_OUT },
  );
  // Al terminar se libera, para que la N se redibuje nítida en pantallas escaladas.
  if (markMove) releaseOnFinish(markMove);
  root.querySelectorAll(".ob-finale-word path").forEach((letter, i) => {
    at(
      letter,
      [
        { opacity: 0, translate: "0 6px" },
        { opacity: 1, translate: "0 0" },
      ],
      start + 980 + i * 70,
      700,
      { easing: EASE_OUT },
    );
  });
  at(
    $(".ob-finale-tagline"),
    [
      { opacity: 0, translate: "-4px 0" },
      { opacity: 1, translate: "0 0" },
    ],
    start + 1440,
    700,
    { easing: EASE_OUT },
  );
  at($(".ob-finale-rule"), [{ scale: "0 1" }, { scale: "1 1" }], start + 1540, 800, { easing: EASE_IN_OUT });
  if (!lite) {
    at(
      $(".ob-finale-shine"),
      [
        { translate: "-184px 0", opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 1, offset: 0.8 },
        { translate: "536px 0", opacity: 0 },
      ],
      start + 1700,
      1100,
      { easing: EASE_IN_OUT },
    );
  }
}

/* ── Componente ───────────────────────────────────────────────────────────── */

interface LaunchSequenceProps {
  /** Acto activo de `SEQUENCE` (0..3): cambia el texto y la ilustración. */
  sceneIndex: number;
}

/**
 * Bienvenida ("Intelligence in motion"): un lienzo que nunca se desmonta. Las cortinillas y la geometría de marca
 * siguen una línea de tiempo; texto e ilustración cambian por acto: WhatsApp multiformato → Necto IA enruta cada
 * intención → seis módulos conectados → el logotipo de Necto.
 */
export function LaunchSequence({ sceneIndex }: LaunchSequenceProps) {
  const ref = useRef<HTMLElement>(null);
  // El primer acto también entra animado: se activa un fotograma después de montar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const activeBeat = mounted ? sceneIndex : -1;
  // Modest devices keep the story and the entrances but drop the continuous loops (see `.ob-launch.is-lite`).
  const [lite] = useState(isLowPowerDevice);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || typeof root.animate !== "function") return;
    const tl = createTimeline();
    buildTimeline(root, tl, lite);
    return () => tl.animations.forEach((animation) => animation.cancel());
    // The timeline is built once, on mount; `lite` never changes.
  }, []);

  const beatClass = (i: number) => (activeBeat === i ? "is-active" : activeBeat > i ? "is-past" : "");

  return (
    <section
      ref={ref}
      className={`ob-launch${lite ? " is-lite" : ""}`}
      data-beat={sceneIndex}
      aria-label="Presentación de Necto IA"
    >
      <div className="ob-wipe ob-wipe-orange" aria-hidden="true" />
      <div className="ob-wipe ob-wipe-navy" aria-hidden="true" />
      <BrandGeometry />

      <div className="ob-copy-stack">
        {COPY.map((beat, i) => (
          <div key={beat.lead} className={`ob-copy-beat ${beatClass(i)}`} aria-hidden={sceneIndex !== i}>
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
                  <span
                    className={line.accent ? "ob-accent-text" : undefined}
                    style={{ "--i": j + 1 } as CSSProperties}
                  >
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
        {ACT_SCENES.map((scene, i) => (
          <div key={i} className={`ob-art-scene ${beatClass(i)}`} data-act={i}>
            {scene}
          </div>
        ))}
      </div>
    </section>
  );
}
