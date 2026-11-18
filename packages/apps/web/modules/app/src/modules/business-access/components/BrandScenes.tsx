import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import { NectoLogo } from "@/brand/NectoLogo";

/*
 * Brand panel slides for /business/access: five static vector compositions, one per view, that rotate like the
 * brand messages of /super/login (`RotatingBrandMessages`). There is no motion inside the art: only the slide
 * changes (fade + 10px). Every slide draws in the same 460×350 box, so the panel never changes height.
 *
 * Shared visual language (keep it when adding art): flat editorial geometry, rounded corners, card borders 1.3,
 * icon strokes 1.5 with round caps, the Necto mark where it adds meaning, no heavy gradients, no people. Colors only
 * through the panel variables (`--na-art-paper`, `--na-art-line`, `--na-art-blue`, `--na-art-cyan`, `--na-orange`) via
 * the `na-art-*` classes in business-access.css, so light (#190088) and dark (#100548) both work on their own.
 */

export type SlideId = "acceso" | "codigo" | "regreso" | "negocios" | "listo";

/** Slide order: the same journey the person takes. */
export const SLIDE_ORDER: readonly SlideId[] = ["acceso", "codigo", "regreso", "negocios", "listo"];

/** Accessible names for the slide indicators. */
export const SLIDE_NAMES: Record<SlideId, string> = {
  acceso: "Acceso sin contraseña",
  codigo: "Código de un solo uso",
  regreso: "Sesión vigente",
  negocios: "Tus negocios",
  listo: "Tu espacio en marcha",
};

/* ── Shared SVG primitives (viewBox 0 0 460 350) ─────────────────────────────── */

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** The Necto mark (the N and its corner) drawn inside an SVG, `size` units wide, top-left at (x, y). */
export function ArtMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g className="na-art-mark" transform={`translate(${x} ${y}) scale(${size / 24})`}>
      {MARK_PATHS.map((path, i) => (
        <path key={i} d={path.d} fill={path.fill} />
      ))}
    </g>
  );
}

/** Cyan round badge with a check, centered at (cx, cy). */
export function ArtCheckBadge({ cx, cy, r = 10 }: { cx: number; cy: number; r?: number }) {
  const s = r / 10;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <circle className="na-art-cyan" r="10" />
      <path className="na-art-check" d="m-4.5 0 3 3 6-6.2" />
    </g>
  );
}

/** Four-pointed sparkle centered at (cx, cy), the same one the orbits use. */
export function ArtSpark({ cx, cy, size = 14 }: { cx: number; cy: number; size?: number }) {
  const h = size / 2;
  const w = size / 7;
  return (
    <path
      className="na-art-spark"
      d={`M${cx} ${cy - h}l${w} ${h - w} ${h - w} ${w}-${h - w} ${w}-${w} ${h - w}-${w}-${h - w}-${h - w}-${w} ${h - w}-${w}Z`}
    />
  );
}

/** Background orbit pair (dotted circle + tilted ellipse) shared by every slide; pass the center. */
export function ArtOrbits({ cx = 230, cy = 174 }: { cx?: number; cy?: number }) {
  return (
    <>
      <circle className="na-art-orbit" cx={cx} cy={cy} r="132" />
      <ellipse className="na-art-orbit-solid" cx={cx} cy={cy} rx="176" ry="92" transform={`rotate(-24 ${cx} ${cy})`} />
    </>
  );
}

/* ── Slide 1 · acceso: the original composition, now static ──────────────────── */

function AccessArt() {
  return (
    <>
      <svg className="na-connections" viewBox="0 0 460 350" fill="none">
        <circle cx="230" cy="174" r="132" />
        <ellipse cx="230" cy="174" rx="176" ry="92" transform="rotate(-24 230 174)" />
        <path className="na-connection-line" d="M87 224Q121 89 294 79M363 139Q383 257 214 281" />
        <path className="na-spark" d="m91 99 4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Zm270 148 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
        <ellipse className="na-scene-shadow" cx="232" cy="302" rx="119" ry="10" />
      </svg>
      <div className="na-device">
        <div className="na-device-screen">
          <div className="na-device-top">
            <i />
            <i />
            <i />
          </div>
          <div className="na-device-content">
            <span className="na-device-symbol">
              <NectoLogo variant="mark" width={64} height={64} />
            </span>
            <strong>Tu negocio, conectado.</strong>
            <span className="na-device-progress">
              <i />
            </span>
            <span className="na-device-mini">Una buena conexión lo cambia todo.</span>
          </div>
        </div>
        <div className="na-device-base" />
      </div>
      <div className="na-access-pass">
        <span className="na-pass-mark">
          <NectoLogo variant="mark" width={64} height={64} />
        </span>
        <div>
          <span>ACCESO A NECTO</span>
          <strong>Sin contraseña</strong>
        </div>
        <span className="na-pass-check">
          <svg viewBox="0 0 24 24">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </span>
      </div>
      <span className="na-motion-token na-token-left">
        <svg viewBox="0 0 32 32">
          <rect x="4" y="7" width="24" height="18" rx="4" />
          <path d="m5 10 11 8 11-8" />
        </svg>
        <i />
      </span>
      <span className="na-motion-token na-token-right">
        <svg viewBox="0 0 32 32">
          <rect x="7" y="14" width="18" height="14" rx="4" />
          <path d="M11 14V9a5 5 0 0 1 10 0v5m-5 6v3" />
        </svg>
      </span>
      <span className="na-orbit-dot" />
    </>
  );
}

/* ── Slide 2 · codigo: one-time code verification ───────────────────────────────── */

/*
 * Slide 2 · codigo: a one-time code card rising out of an open envelope, stamped with a cyan "verified" seal.
 * Satellites: a clock token (code validity, lower left) and a shield token (secure access, upper right).
 */

// Six code cells split 3 + 3 around a center dot (card coordinates, card centered on x = 230).
const CODE = ["4", "8", "2", "1", "9", "5"];
const CELL_X = [172, 191, 210, 234, 253, 272];

function CodeArt() {
  return (
    <svg className="na-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, dotted links, sparks and base shadow */}
      <ArtOrbits />
      <path className="na-art-link" strokeDasharray="1 4" d="M118 112Q140 150 132 186M354 126Q394 178 340 214" />
      <ArtSpark cx={148} cy={46} size={14} />
      <ArtSpark cx={386} cy={252} size={10} />
      <ellipse className="na-art-shadow" cx="232" cy="300" rx="122" ry="10" />

      {/* Envelope back and open flap (behind the card) */}
      <rect className="na-art-card" x="148" y="162" width="164" height="124" rx="10" />
      <path className="na-art-card" strokeLinejoin="round" d="M150 166 230 120l80 46" />

      {/* Code card rising out of the envelope */}
      <g transform="rotate(-4 230 156)">
        <rect className="na-art-card" x="162" y="66" width="136" height="150" rx="14" />
        <rect className="na-art-orange-tint" x="174" y="78" width="26" height="26" rx="8" />
        <ArtMark x={178} y={82} size={18} />
        <text className="na-art-label" x="208" y="88" fontSize="6">
          CÓDIGO DE ACCESO
        </text>
        <text className="na-art-text" x="208" y="100" fontSize="8">
          Un solo uso
        </text>
        {CODE.map((digit, i) => (
          <g key={i}>
            <rect className="na-art-soft" x={CELL_X[i]} y="116" width="16" height="22" rx="5" />
            <text className="na-art-text" x={CELL_X[i] + 8} y="131" fontSize="11" textAnchor="middle">
              {digit}
            </text>
          </g>
        ))}
        <circle className="na-art-ink" cx="230" cy="127" r="1.4" />
        {/* Quiet expiry line: kept neutral so the orange mark and the clock carry the accent */}
        <rect className="na-art-soft" x="176" y="150" width="108" height="4" rx="2" />
      </g>

      {/* Envelope front pocket with its folds */}
      <path className="na-art-card" strokeLinejoin="round" d="M148 170 230 214l82-44v106a10 10 0 0 1-10 10H158a10 10 0 0 1-10-10Z" />
      <path className="na-art-rule" d="m154 281 58-40m94 40-58-40" />

      {/* Verification seal stamped on the envelope */}
      <g transform="translate(304 240) rotate(-6)">
        <circle className="na-art-card" r="30" />
        <path id="na-code-seal-arc" d="M-19.9 11.5a23 23 0 1 1 39.8 0" fill="none" />
        <text className="na-art-label" fontSize="6" textAnchor="middle">
          <textPath href="#na-code-seal-arc" startOffset="50%">
            CÓDIGO VERIFICADO
          </textPath>
        </text>
        <ArtCheckBadge cx={0} cy={4} r={11} />
      </g>

      {/* Satellite: clock token (validity) */}
      <g transform="translate(96 222) rotate(-12)">
        <rect className="na-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
        <circle className="na-art-icon-accent" cy="-6" r="10" />
        <path className="na-art-icon-accent" d="M0-12v6l4 3" />
        <text className="na-art-text" y="17" fontSize="7" textAnchor="middle">
          10 min
        </text>
      </g>

      {/* Satellite: shield token (secure access) */}
      <g transform="translate(356 88) rotate(9)">
        <rect className="na-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
        <path className="na-art-icon" d="M0-12 10-8v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13v-7Z" />
        <path className="na-art-icon" d="m-4 0 3 3 5.5-5.5" />
      </g>

      {/* Cyan orb */}
      <circle className="na-art-cyan-halo" cx="112" cy="104" r="11.5" />
      <circle className="na-art-cyan" cx="112" cy="104" r="5.5" />
    </svg>
  );
}

/* ── Slide 3 · regreso: trusted device and valid session ────────────────────────── */

/*
 * Slide 3 · regreso: the session is still valid on a trusted device, so no new code is needed.
 * A tall identity card with a shield-framed Necto mark sits in the center; a trusted-device token (left) and a
 * fingerprint token (right) feed into it with soft links, and a "Sin código nuevo" chip overlaps its foot.
 */
function ReturnArt() {
  return (
    <svg className="na-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, links, sparks, shadow */}
      <ArtOrbits />
      <path className="na-art-link" strokeDasharray="1 4" d="M124 148Q146 178 170 178" />
      <path className="na-art-link" strokeDasharray="1 4" d="M350 150Q320 158 292 156" />
      <ArtSpark cx={78} cy={84} size={14} />
      <ArtSpark cx={390} cy={206} size={10} />
      <ellipse className="na-art-shadow" cx="232" cy="302" rx="120" ry="10" />

      <g transform="translate(0 8)">
      {/* Center: identity card */}
      <g transform="rotate(-3 230 160)">
        <rect className="na-art-card" x="170" y="56" width="120" height="208" rx="16" />
        {/* Shield framing the Necto mark */}
        <path
          className="na-art-card"
          d="M230 76 255 84.5V104c0 16-10.5 26.5-25 32-14.5-5.5-25-16-25-32V84.5Z"
        />
        <ArtMark x={218} y={92} size={24} />
        <text className="na-art-label" x="230" y="156" fontSize="6" textAnchor="middle">
          ACCESO A NECTO
        </text>
        <text className="na-art-text" x="230" y="172" fontSize="11" textAnchor="middle">
          Hola de nuevo
        </text>
        {/* "Sesión vigente" badge */}
        <rect className="na-art-soft" x="190" y="182" width="80" height="20" rx="10" />
        <ArtCheckBadge cx={201} cy={192} r={6} />
        <text className="na-art-text" x="211" y="194.6" fontSize="7">
          Sesión vigente
        </text>
        <line className="na-art-rule" x1="186" y1="214" x2="274" y2="214" />
        <rect className="na-art-soft" x="186" y="224" width="52" height="4" rx="2" />
      </g>

      {/* Left satellite: trusted device */}
      <g transform="rotate(-12 98 126)">
        <rect className="na-art-card" x="69" y="97" width="58" height="58" rx="18" />
        <rect className="na-art-icon" x="84" y="113" width="28" height="18" rx="3.5" />
        <path className="na-art-icon" d="M92 139h12M98 131v8" />
        <ArtCheckBadge cx={124} cy={100} r={6} />
      </g>

      {/* Right satellite: fingerprint */}
      <g transform="translate(14 32) rotate(9 358 100)">
        <rect className="na-art-card" x="331" y="73" width="55" height="55" rx="18" />
        {/* Fingerprint: nested arcs around a center ridge */}
        <path
          className="na-art-icon"
          d="M346.5 108v-8a11.5 11.5 0 0 1 23 0v2.5M351.5 113v-13a6.5 6.5 0 0 1 13 0v5.5c0 3.6-.7 7-2 10M358 100v7.5c0 3.4-.8 6.4-2.3 9M369.5 108c-.2 2.8-.8 5.4-1.7 7.8M349.8 89.6a13.5 13.5 0 0 1 16.4 0"
        />
      </g>

      {/* Overlapping chip: no new code needed */}
      <g transform="rotate(5 294 250)">
        <rect className="na-art-card" x="234" y="230" width="124" height="40" rx="12" />
        <rect className="na-art-soft" x="242" y="238" width="24" height="24" rx="8" />
        <circle className="na-art-icon" cx="250.5" cy="250" r="3.6" />
        <path className="na-art-icon" d="M254.1 250h6.4M258.5 250v2.8" />
        <text className="na-art-label" x="273" y="246" fontSize="6">
          VERIFICACIÓN
        </text>
        <text className="na-art-text" x="273" y="259" fontSize="8">
          Sin código nuevo
        </text>
      </g>

      {/* Cyan orb */}
      <circle className="na-art-cyan-halo" cx="112" cy="234" r="11.5" />
      <circle className="na-art-cyan" cx="112" cy="234" r="5.5" />
      </g>
    </svg>
  );
}

/* ── Slide 4 · negocios: many businesses under one access ───────────────────────── */

/*
 * Slide 4 · negocios: many businesses under one access.
 * A Necto hub sits in the center and radiates soft links to three staggered business cards (bakery, cafe, branch).
 * Each card has a neutral glyph chip, its name and a meta line; the orange "+" on the storefront token is the single accent.
 * Satellite: an "add business" storefront token (left); the three cards already read as "many businesses".
 */

interface BusinessCardProps {
  x: number;
  y: number;
  w: number;
  angle: number;
  name: string;
  meta: string;
  glyph: string;
}

const CARD_H = 56;

/** One business card: glyph chip, name and meta line. */
function BusinessCard({ x, y, w, angle, name, meta, glyph }: BusinessCardProps) {
  return (
    <g transform={`rotate(${angle} ${x + w / 2} ${y + CARD_H / 2})`}>
      <rect className="na-art-card" x={x} y={y} width={w} height={CARD_H} rx="14" />
      {/* Glyph chip */}
      <rect className="na-art-soft" x={x + 11} y={y + 13} width="30" height="30" rx="9" />
      <path className="na-art-icon" transform={`translate(${x + 18} ${y + 20})`} d={glyph} />
      <text className="na-art-text" x={x + 53} y={y + 27} fontSize="11">
        {name}
      </text>
      <text className="na-art-label" x={x + 53} y={y + 39} fontSize="6">
        {meta}
      </text>
    </g>
  );
}

// 16-unit line glyphs.
const BREAD = "M2 14V9a6 5 0 0 1 12 0v5ZM6 7.5 5 10M9 7l-1 3M12 7.5l-1 2.5";
const CUP = "M2.5 6h9v3.5a4.5 4.5 0 0 1-9 0ZM11.5 7h1.2a2 2 0 0 1 0 4h-1.6M5 1.5v2M8.5 1.5v2M2 15h10";
const BUILDING = "M3 15V2.5h7V15M10 7h4v8M1.5 15h14M5.5 5.5h2M5.5 8.5h2M5.5 11.5h2";

function BusinessesArt() {
  return (
    <svg className="na-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, sparks and base shadow */}
      <ArtOrbits />
      <ArtSpark cx={300} cy={52} size={14} />
      <ArtSpark cx={392} cy={266} size={10} />
      <ellipse className="na-art-shadow" cx="232" cy="302" rx="124" ry="10" />

      {/* Links from the hub to each business and to the add token */}
      <path className="na-art-link" strokeDasharray="1 4" d="M200 150Q180 128 170 118" />
      <path className="na-art-link" strokeDasharray="1 4" d="M266 174Q272 171 278 169" />
      <path className="na-art-link" strokeDasharray="1 4" d="M230 212V236" />
      <path className="na-art-link" strokeDasharray="1 4" d="M196 186Q160 210 128 222" />

      {/* Business cards */}
      <BusinessCard x={74} y={74} w={150} angle={-7} name="Panadería Sol" meta="PEDIDOS · TURNOS" glyph={BREAD} />
      <BusinessCard x={276} y={126} w={136} angle={6} name="Café Central" meta="CAJA · MESAS" glyph={CUP} />
      <BusinessCard x={164} y={232} w={146} angle={-3} name="Sede Norte" meta="EQUIPO · INVENTARIO" glyph={BUILDING} />

      {/* Necto hub */}
      <rect className="na-art-card" x="194" y="140" width="72" height="72" rx="20" />
      <ArtMark x={213} y={159} size={34} />
      <ArtCheckBadge cx={264} cy={142} r={8} />

      {/* Satellite: add-business storefront token */}
      <g transform="rotate(-12 98 214) translate(-2 8)">
        <rect className="na-art-card" x="70" y="186" width="56" height="56" rx="18" />
        <path className="na-art-icon" d="M86 211v12h24v-12M84 211l3-8h22l3 8ZM95 223v-6h6v6" />
        <circle className="na-art-orange" cx="124" cy="188" r="6" />
        <path className="na-art-check" strokeWidth="1.4" d="M124 185.6v4.8M121.6 188h4.8" />
      </g>


      {/* Cyan orb */}
      <circle className="na-art-cyan-halo" cx="372" cy="82" r="11.5" />
      <circle className="na-art-cyan" cx="372" cy="82" r="5.5" />
    </svg>
  );
}

/* ── Slide 5 · listo: modular ecosystem online ──────────────────────────────────── */

/*
 * Slide 5 · listo: the modular ecosystem running. A floating board holds five module tiles plugged into an
 * operating core (Necto mark + "En línea"); the sixth tile (Pedidos) hovers above its dashed slot, snapping in.
 * Satellites: the lifted Pedidos tile and a growth chart token.
 */

interface Tile {
  name: string;
  x: number;
  y: number;
  glyph: string;
}

const TILE_W = 68;
const TILE_H = 38;

// Glyphs drawn around (0, 0) in a 16-unit box.
const GLYPH = {
  bag: "M-6-2.5h12l-1 8.5h-10Z M-3-2.5v-1.5a3 3 0 0 1 6 0v1.5",
  bookmark: "M-4.5-6.5h9v13l-4.5-3.6-4.5 3.6Z",
  calendar: "M-5-5.5h10a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-10a2.5 2.5 0 0 1-2.5-2.5v-8a2.5 2.5 0 0 1 2.5-2.5Z M-7.5-1.5h15 M-3-7.5v3 M3-7.5v3",
  clock: "M0-7a7 7 0 1 1 0 14a7 7 0 1 1 0-14Z M0-3.5v3.5l2.8 1.8",
  box: "M-6.5-3 0-6.5 6.5-3v6.5L0 7l-6.5-3.5Z M-6.5-3 0 .5 6.5-3 M0 .5V7",
  referral: "M-5.5 5.5 5.5-5.5 M-1-5.5h6.5V1",
};

// Board coordinates (before the board tilt). Left column x = 116, right column x = 272; rows y = 94, 146, 198.
const ROW_A = 94;
const ROW_B = 146;
const ROW_C = 198;
const PLUGGED: Tile[] = [
  { name: "Reservas", x: 116, y: ROW_B, glyph: GLYPH.bookmark },
  { name: "Inventario", x: 116, y: ROW_C, glyph: GLYPH.box },
  { name: "Agenda", x: 272, y: ROW_A, glyph: GLYPH.calendar },
  { name: "Turnos", x: 272, y: ROW_B, glyph: GLYPH.clock },
  { name: "Referidos", x: 272, y: ROW_C, glyph: GLYPH.referral },
];

function ModuleTile({ name, x, y, glyph, accent = false }: Tile & { accent?: boolean }) {
  return (
    <g>
      <rect className="na-art-card" x={x} y={y} width={TILE_W} height={TILE_H} rx="11" />
      <rect className={accent ? "na-art-orange-tint" : "na-art-soft"} x={x + 8} y={y + 8} width="22" height="22" rx="7" />
      <path className={accent ? "na-art-icon-accent" : "na-art-icon"} transform={`translate(${x + 19} ${y + 19}) scale(.82)`} d={glyph} />
      <text className="na-art-text" x={x + 35} y={y + 21.5} fontSize="7">
        {name}
      </text>
    </g>
  );
}

function ReadyArt() {
  return (
    <svg className="na-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, dotted link, sparks and base shadow */}
      <ArtOrbits />
      <path className="na-art-link" strokeDasharray="1 4" d="M392 140Q404 250 276 290" />
      <ArtSpark cx={296} cy={50} size={14} />
      <ArtSpark cx={128} cy={286} size={10} />
      <ellipse className="na-art-shadow" cx="230" cy="302" rx="118" ry="10" />

      {/* Main subject, nudged down to sit on the base shadow */}
      <g transform="translate(0 4)">
      {/* Floating board, slightly tilted */}
      <g transform="rotate(-5 230 174)">
        <rect className="na-art-card" x="104" y="82" width="252" height="166" rx="20" />

        {/* Connectors from each slot to the core */}
        <path className="na-art-wire" d="M184 165h10M184 217h10M266 113h6M266 165h6M266 217h6" />
        <path className="na-art-wire" strokeDasharray="2 3" d="M184 113h10" />

        {/* Empty slot waiting for the Pedidos tile */}
        <rect className="na-art-rule" strokeDasharray="3 3" x="116" y={ROW_A} width={TILE_W} height={TILE_H} rx="11" />

        {PLUGGED.map((tile) => (
          <ModuleTile key={tile.name} {...tile} />
        ))}

        {/* Operating core */}
        <rect className="na-art-card" x="194" y="96" width="72" height="140" rx="16" />
        <rect className="na-art-orange-tint" x="215" y="120" width="30" height="30" rx="10" />
        <ArtMark x={220} y={125} size={20} />
        <text className="na-art-label" x="230" y="170" fontSize="6" textAnchor="middle">
          TU ESPACIO
        </text>
        <text className="na-art-text" x="230" y="185" fontSize="11" textAnchor="middle">
          En línea
        </text>
        <ArtCheckBadge cx={262} cy={100} r={7.5} />
        {/* One dot per module: five live, one joining */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} className={i === 5 ? "na-art-orange" : "na-art-cyan"} cx={215 + i * 6} cy="208" r="1.8" />
        ))}
      </g>

      {/* Pedidos tile, lifted above its slot while it snaps in */}
      <path className="na-art-link" strokeDasharray="1 3.5" d="M128 76Q134 86 142 96" />
      <g transform="rotate(-10 118 50)">
        <ModuleTile name="Pedidos" x={84} y={32} glyph={GLYPH.bag} accent />
      </g>

      {/* Satellite: growth chart token */}
      <g transform="translate(384 76) rotate(9)">
        <rect className="na-art-card" x="-28" y="-28" width="56" height="56" rx="18" />
        <path className="na-art-icon" d="M-12 9h24M-9 5V1M-3 5v-5M3 5v-8" />
        <path className="na-art-icon-accent" d="M9 5v-12" />
        <text className="na-art-text" y="20" fontSize="7" textAnchor="middle">
          +24%
        </text>
      </g>

      </g>

      {/* Cyan orb */}
      <circle className="na-art-cyan-halo" cx="72" cy="206" r="11.5" />
      <circle className="na-art-cyan" cx="72" cy="206" r="5.5" />
    </svg>
  );
}

const ART: Record<SlideId, () => ReactNode> = {
  acceso: AccessArt,
  codigo: CodeArt,
  regreso: ReturnArt,
  negocios: BusinessesArt,
  listo: ReadyArt,
};

/** The illustration of one slide. */
export function SlideArt({ slide }: { slide: SlideId }) {
  const Art = ART[slide];
  return <Art />;
}

/* ── Slide rotation (same pattern as useRotatingBrandMessages) ──────────────── */

const EXIT_DURATION_MS = 240;
const ROTATE_MS = 2800;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Current slide and its fade state. It rotates every 5.5 s (paused while the tab is hidden, off with reduced motion),
 * jumps to the slide of the active view when the view changes, and restarts the timer after a manual choice.
 */
export function useBrandSlides(view: SlideId) {
  const [index, setIndex] = useState(() => SLIDE_ORDER.indexOf(view));
  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const [cycle, setCycle] = useState(0);
  const exitTimer = useRef<number | null>(null);
  const current = useRef(index);
  current.current = index;

  const select = useCallback((next: number) => {
    setCycle((value) => value + 1);
    if (next === current.current) return;
    if (exitTimer.current) window.clearTimeout(exitTimer.current);
    if (prefersReducedMotion()) {
      setIndex(next);
      return;
    }
    setFadeState("out");
    exitTimer.current = window.setTimeout(() => {
      setIndex(next);
      setFadeState("in");
    }, EXIT_DURATION_MS);
  }, []);

  // The form moved to another view: show its slide.
  useEffect(() => {
    select(SLIDE_ORDER.indexOf(view));
  }, [view, select]);

  // Automatic rotation; `cycle` restarts it after every jump.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      select((current.current + 1) % SLIDE_ORDER.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [cycle, select]);

  useEffect(
    () => () => {
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  return { index, slide: SLIDE_ORDER[index], fadeState, select };
}

interface SlideIndicatorsProps {
  activeIndex: number;
  onSelect: (index: number) => void;
}

/** Clickable slide dots, like BrandMessageIndicators: the active one is a long orange pill. */
export function SlideIndicators({ activeIndex, onSelect }: SlideIndicatorsProps) {
  return (
    <div className="na-slide-dots" role="group" aria-label="Ilustraciones del panel">
      {SLIDE_ORDER.map((slide, i) => (
        <button
          key={slide}
          type="button"
          className={i === activeIndex ? "is-active" : undefined}
          aria-label={`Ilustración ${i + 1} de ${SLIDE_ORDER.length}: ${SLIDE_NAMES[slide]}`}
          aria-current={i === activeIndex ? "true" : undefined}
          onClick={() => onSelect(i)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}
