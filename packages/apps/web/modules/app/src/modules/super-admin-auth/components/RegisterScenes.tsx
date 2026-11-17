import type { ReactNode } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";
import type { BrandMessage } from "./RotatingBrandMessages";

/*
 * Brand panel slides for /super/register: five static vector compositions that rotate with their message (same
 * timing, dots and fade as the login brand messages). No motion inside the art; every slide draws in the same
 * 460×350 box, so the panel never changes height.
 *
 * Shared visual language: flat editorial geometry, rounded corners, card borders 1.3, icon strokes 1.5 with round
 * caps, the Necto mark where it adds meaning, no heavy gradients, no people. Colors only through the `sa-art-*`
 * classes in auth-layout.css, which read the panel variables (orange panel in light, indigo in dark).
 */

export type RegisterSlideId = "cuenta" | "identidad" | "negocios" | "equipo" | "modulos";

export interface RegisterSlide {
  id: RegisterSlideId;
  message: BrandMessage;
}

/** The register journey, one idea per slide. */
export const REGISTER_SLIDES: readonly RegisterSlide[] = [
  {
    id: "cuenta",
    message: { title: "Crea tu cuenta de Necto.", subtitle: "Un registro y todo tu ecosistema empieza a conectarse." },
  },
  {
    id: "identidad",
    message: { title: "Tu identidad, protegida.", subtitle: "Validamos tus datos para cuidar cada negocio que crees." },
  },
  {
    id: "negocios",
    message: { title: "Tus negocios, en un solo lugar.", subtitle: "Crea y organiza cada negocio desde tu workspace." },
  },
  {
    id: "equipo",
    message: { title: "Invita a quien los administra.", subtitle: "Cada administrador entra con su correo, sin contraseñas." },
  },
  {
    id: "modulos",
    message: { title: "Activa lo que necesitas.", subtitle: "Pedidos, agenda, reservas y más: tú eliges los módulos." },
  },
];

/* ── Shared SVG primitives (viewBox 0 0 460 350) ─────────────────────────────── */

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** The Necto mark (the N and its corner) drawn inside an SVG, `size` units wide, top-left at (x, y). */
export function ArtMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g className="sa-art-mark" transform={`translate(${x} ${y}) scale(${size / 24})`}>
      {MARK_PATHS.map((path, i) => (
        <path key={i} d={path.d} fill={path.fill} />
      ))}
    </g>
  );
}

/** Cyan round badge with a check, centered at (cx, cy). */
export function ArtCheckBadge({ cx, cy, r = 10 }: { cx: number; cy: number; r?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${r / 10})`}>
      <circle className="sa-art-cyan" r="10" />
      <path className="sa-art-check" d="m-4.5 0 3 3 6-6.2" />
    </g>
  );
}

/** Four-pointed sparkle centered at (cx, cy). */
export function ArtSpark({ cx, cy, size = 14 }: { cx: number; cy: number; size?: number }) {
  const h = size / 2;
  const w = size / 7;
  return (
    <path
      className="sa-art-spark"
      d={`M${cx} ${cy - h}l${w} ${h - w} ${h - w} ${w}-${h - w} ${w}-${w} ${h - w}-${w}-${h - w}-${h - w}-${w} ${h - w}-${w}Z`}
    />
  );
}

/** Background orbit pair (dotted circle + tilted ellipse); pass the center. */
export function ArtOrbits({ cx = 230, cy = 174 }: { cx?: number; cy?: number }) {
  return (
    <>
      <circle className="sa-art-orbit" cx={cx} cy={cy} r="132" />
      <ellipse className="sa-art-orbit-solid" cx={cx} cy={cy} rx="176" ry="92" transform={`rotate(-24 ${cx} ${cy})`} />
    </>
  );
}

/* ── Slide 1 · cuenta: create your account ──────────────────────────────────────── */

/*
 * Slide 1 · cuenta: the first step, a simple sign-up card.
 * A slightly tilted card holds three field rows (username, email, password), the primary "Crear cuenta" button
 * and a small "¿Ya tienes cuenta?" hint. A "Cuenta creada" toast with a cyan check lands on the card's upper-left
 * corner. Satellites: an "@" token (lower left) and a key token (upper right), joined to the card by dotted links.
 */
function CuentaArt() {
  // Field rows inside the card: label baseline; the input box sits 5 units below it.
  const fields = [
    { y: 118, label: "USUARIO" },
    { y: 150, label: "CORREO" },
    { y: 182, label: "CONTRASEÑA" },
  ];
  return (
    <svg className="sa-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, dotted links, sparks and base shadow */}
      <ArtOrbits />
      <path className="sa-art-link" strokeDasharray="1 4" d="M121 210Q140 216 159 214M337 146Q322 152 306 150" />
      <ArtSpark cx={396} cy={86} size={11} />
      <ArtSpark cx={74} cy={132} size={13} />
      <ellipse className="sa-art-shadow" cx="231" cy="288" rx="112" ry="10" />

      {/* Sign-up card */}
      <g transform="rotate(-4 230 160)">
        <rect className="sa-art-card" x="156" y="60" width="150" height="200" rx="16" />
        {/* Header: mark tile + title */}
        <rect className="sa-art-orange-tint" x="170" y="76" width="28" height="28" rx="9" />
        <ArtMark x={174} y={80} size={20} />
        <text className="sa-art-label" x="206" y="87" fontSize="6">
          REGISTRO
        </text>
        <text className="sa-art-text" x="206" y="100" fontSize="11">
          Nueva cuenta
        </text>

        {fields.map((f) => (
          <g key={f.label}>
            <text className="sa-art-label" x="170" y={f.y} fontSize="6">
              {f.label}
            </text>
            <rect className="sa-art-soft" x="170" y={f.y + 5} width="122" height="20" rx="6" />
          </g>
        ))}
        {/* Username row */}
        <text className="sa-art-text" x="180" y="136" fontSize="8">
          @usuario
        </text>
        {/* Email row */}
        <text className="sa-art-text" x="180" y="168" fontSize="8">
          tu@correo.com
        </text>
        {/* Password row: dots + eye */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle key={i} className="sa-art-ink" cx={182 + i * 8} cy="197" r="2" />
        ))}
        <path className="sa-art-icon" d="M266 197c2.5-3.6 5.5-5.4 8-5.4s5.5 1.8 8 5.4c-2.5 3.6-5.5 5.4-8 5.4s-5.5-1.8-8-5.4Z" />
        <circle className="sa-art-ink" cx="274" cy="197" r="1.6" />

        {/* Primary button */}
        <rect className="sa-art-orange" x="170" y="216" width="122" height="24" rx="8" />
        <text className="sa-art-on-accent" x="231" y="231" fontSize="8" fontWeight="500" textAnchor="middle">
          Crear cuenta
        </text>
        <text className="sa-art-label" x="231" y="252" fontSize="6" textAnchor="middle">
          ¿YA TIENES CUENTA?
        </text>
      </g>

      {/* "Cuenta creada" toast landing on the card's upper-left corner */}
      <g transform="translate(145 58) rotate(-6)">
        <rect className="sa-art-card" x="-50" y="-18" width="100" height="36" rx="12" />
        <ArtCheckBadge cx={-31} cy={0} r={10} />
        <text className="sa-art-label" x="-16" y="-3" fontSize="6">
          LISTO
        </text>
        <text className="sa-art-text" x="-16" y="8" fontSize="8">
          Cuenta creada
        </text>
      </g>

      {/* Satellite: "@" token (identity), lower left */}
      <g transform="translate(92 214) rotate(-12)">
        <rect className="sa-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
        <circle className="sa-art-icon-accent" r="5" />
        <path className="sa-art-icon-accent" d="M5-5v7a3.5 3.5 0 0 0 7 0v-2a12 12 0 1 0-4.7 9.5" />
      </g>

      {/* Satellite: key token (password), upper right */}
      <g transform="translate(366 140) rotate(9)">
        <rect className="sa-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
        <circle className="sa-art-icon" cx="-6" cy="0" r="6.5" />
        <path className="sa-art-icon" d="M0.5 0H13M9 0v5M13 0v4" />
      </g>

      {/* Cyan orb, lower right */}
      <circle className="sa-art-cyan-halo" cx="364" cy="232" r="11.5" />
      <circle className="sa-art-cyan" cx="364" cy="232" r="5.5" />
    </svg>
  );
}

/* ── Slide 2 · identidad: identity document protected ───────────────────────────── */

/*
 * Slide 2 · identidad: a landscape identity document (masked number, type chip, geometric emblem instead of a
 * photo) sealed by a shield with a cyan check. A tax document (NIT) peeks out behind it. Satellites: a shield-keyhole token
 * (upper left) and a padlocked-document token (upper right).
 */
function IdentityArt() {
  return (
    <svg className="sa-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, dotted links, sparks and base shadow */}
      <ArtOrbits />
      <path className="sa-art-link" strokeDasharray="1 4" d="M112 138Q120 172 138 184M350 236Q378 212 384 152" />
      <ArtSpark cx={156} cy={52} size={14} />
      <ArtSpark cx={380} cy={250} size={10} />
      <ellipse className="sa-art-shadow" cx="232" cy="302" rx="122" ry="10" />

      <g transform="translate(0 10)">
      {/* Back: tax document (NIT) peeking out */}
      <g transform="rotate(7 266 130)">
        <rect className="sa-art-card" x="186" y="70" width="160" height="108" rx="14" />
        <text className="sa-art-label" x="202" y="90" fontSize="6">
          REGISTRO TRIBUTARIO
        </text>
        <text className="sa-art-text" x="202" y="103" fontSize="8">
          NIT 901 ••• ••7
        </text>
        <rect className="sa-art-soft" x="202" y="110" width="64" height="5" rx="2.5" />
        {/* Barcode stamp: vertical strokes of varying width */}
        <rect className="sa-art-soft" x="298" y="80" width="34" height="24" rx="6" />
        <path className="sa-art-icon" d="M306 86v12m4-12v12m6-12v12m5-12v12" />
        <path className="sa-art-icon" strokeWidth="2.6" strokeLinecap="butt" d="M313 86v12m11-12v12" />
      </g>

      {/* Front: identity document */}
      <g transform="rotate(-4 230 178)">
        <rect className="sa-art-card" x="134" y="118" width="192" height="122" rx="16" />
        <text className="sa-art-label" x="150" y="139" fontSize="6">
          DOCUMENTO DE IDENTIDAD
        </text>
        <rect className="sa-art-orange-tint" x="286" y="128" width="26" height="15" rx="6" />
        <text className="sa-art-orange" x="299" y="138.6" fontSize="8" fontWeight="600" textAnchor="middle">
          CC
        </text>
        <path className="sa-art-rule" d="M150 151h160" />

        {/* Geometric emblem block in place of a photo */}
        <rect className="sa-art-soft" x="150" y="161" width="52" height="62" rx="10" />
        <path className="sa-art-icon" d="M176 172 191 180.5v17L176 206l-15-8.5v-17Z" />
        <ArtMark x={167} y={180} size={18} />

        {/* Masked number and quiet data lines */}
        <text className="sa-art-label" x="216" y="170" fontSize="6">
          NÚMERO
        </text>
        <text className="sa-art-text" x="216" y="186" fontSize="11">
          1.0•• ••• 342
        </text>
        <rect className="sa-art-soft" x="216" y="198" width="78" height="5" rx="2.5" />
        <rect className="sa-art-soft" x="216" y="210" width="50" height="5" rx="2.5" />
      </g>

      {/* Shield seal overlapping the card corner */}
      <g transform="translate(318 238) rotate(8) scale(1.12)">
        <path className="sa-art-card" d="M0-26 22-18V-2c0 15-9.5 24-22 29-12.5-5-22-14-22-29v-16Z" />
        <ArtCheckBadge cx={0} cy={-1} r={11} />
      </g>

      </g>

      {/* Satellite: shield token with keyhole (protected data) */}
      <g transform="translate(100 108) rotate(-12)">
        <rect className="sa-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
        <path className="sa-art-icon" d="M0-14 11-10v8c0 7.5-4.8 12.5-11 15-6.2-2.5-11-7.5-11-15v-8Z" />
        <circle className="sa-art-icon" cy="-3" r="3" />
        <path className="sa-art-icon" d="M0 0v5" />
      </g>

      {/* Satellite: padlocked document token */}
      <g transform="translate(388 118) rotate(9)">
        <rect className="sa-art-card" x="-28" y="-28" width="56" height="56" rx="18" />
        <path className="sa-art-icon" d="M-15-14h12l7 7v12M-6 13h-9v-27M-3-14v7h7" />
        <path className="sa-art-icon" d="M-10-1h8m-8 5h4" />
        <rect className="sa-art-card" x="-3" y="0" width="22" height="18" rx="5" stroke="none" />
        <rect className="sa-art-icon-accent" x="-1" y="2" width="18" height="14" rx="4" />
        <path className="sa-art-icon-accent" d="M8 7.5v3" />
        <path className="sa-art-icon-accent" d="M3.5 2v-3a4.5 4.5 0 0 1 9 0v3" />
      </g>

      {/* Cyan orb */}
      <circle className="sa-art-cyan-halo" cx="128" cy="268" r="11.5" />
      <circle className="sa-art-cyan" cx="128" cy="268" r="5.5" />
    </svg>
  );
}

/* ── Slide 3 · negocios: your workspace and its businesses ──────────────────────── */

/*
 * Slide 3 · negocios: the workspace directory. A slightly tilted board titled "Tu espacio · 3 negocios" holds a
 * 2x2 grid of business tiles (line glyph + name + cyan active dot); the fourth slot is a dashed orange
 * "Nuevo negocio" tile. Satellites: a storefront token (upper left) and a folder token (lower right).
 */

interface BizTile {
  x: number;
  y: number;
  /** Line glyph drawn in local coordinates centered on (0,0), about 14 units wide. */
  glyph: string;
  name: string;
}

const TILE_W = 88;
const TILE_H = 60;

// Glyphs: pastry dome (cloche), cup on a saucer, office building.
const DOME = "M-7 4.5h14M-5.5 4.5a5.5 5.5 0 0 1 11 0M0-1v-2.5M-1.5-3.5h3";
const CUP = "M-5.5-3.5h8v4a4 4 0 0 1-8 0ZM2.5-2h1.5a2 2 0 0 1 0 4h-1.5M-7 6.5h11";
const BUILDING = "M-5.5 6.5v-12h7v12M1.5-1.5h4.5v8M-7 6.5h14M-3.5-3h3M-3.5 0h3M-3.5 3h3";

const TILES: BizTile[] = [
  { x: 140, y: 124, glyph: DOME, name: "Pastelería Luz" },
  { x: 238, y: 124, glyph: CUP, name: "Té Andino" },
  { x: 140, y: 194, glyph: BUILDING, name: "Sede Sur" },
];

function Tile({ x, y, glyph, name }: BizTile) {
  return (
    <g>
      <rect className="sa-art-card" x={x} y={y} width={TILE_W} height={TILE_H} rx="12" />
      <rect className="sa-art-soft" x={x + 9} y={y + 9} width="24" height="24" rx="8" />
      <path className="sa-art-icon" transform={`translate(${x + 21} ${y + 21})`} d={glyph} />
      <circle className="sa-art-cyan" cx={x + TILE_W - 13} cy={y + 13} r="3" />
      <text className="sa-art-text" x={x + 9} y={y + 46} fontSize="8">
        {name}
      </text>
      <rect className="sa-art-soft" x={x + 9} y={y + 51} width="30" height="3" rx="1.5" />
    </g>
  );
}

function NegociosArt() {
  return (
    <svg className="sa-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, dotted links, sparks and base shadow */}
      <ArtOrbits />
      <path className="sa-art-link" strokeDasharray="1 4" d="M112 128Q118 134 124 137M362 222Q358 218 352 214" />
      <ArtSpark cx={168} cy={44} size={14} />
      <ArtSpark cx={98} cy={232} size={10} />
      <ellipse className="sa-art-shadow" cx="233" cy="302" rx="118" ry="10" />

      {/* Workspace directory board */}
      <g transform="rotate(-3 233 168)">
        <rect className="sa-art-card" x="128" y="70" width="210" height="196" rx="18" />
        {/* Header: mark tile + title */}
        <rect className="sa-art-orange-tint" x="140" y="81" width="27" height="27" rx="8" />
        <ArtMark x={143.5} y={84.5} size={20} />
        <text className="sa-art-label" x="175" y="91" fontSize="6">
          TU ESPACIO
        </text>
        <text className="sa-art-text" x="175" y="104" fontSize="11">
          3 negocios
        </text>
        {/* Header search pill */}
        <rect className="sa-art-soft" x="278" y="86" width="48" height="17" rx="8.5" />
        <circle className="sa-art-icon" cx="289" cy="94" r="3" />
        <path className="sa-art-icon" d="M291.2 96.2l2 2" />
        <path className="sa-art-rule" d="M298 94.5H318" />
        <path className="sa-art-rule" d="M140 116H326" />

        {TILES.map((t) => (
          <Tile key={t.name} {...t} />
        ))}

        {/* Fourth slot: dashed "Nuevo negocio" tile */}
        <rect
          className="sa-art-orange-tint sa-art-dash-accent"
          x="238"
          y="194"
          width={TILE_W}
          height={TILE_H}
          rx="12"
        />
        <rect className="sa-art-card" x="270" y="202" width="24" height="24" rx="8" />
        <path className="sa-art-icon-accent" d="M282 209v10M277 214h10" />
        <text className="sa-art-text" x="282" y="242" fontSize="8" textAnchor="middle">
          Nuevo negocio
        </text>
      </g>
      <ArtCheckBadge cx={336} cy={70} r={9} />

      {/* Satellite: storefront token */}
      <g transform="translate(82 110) rotate(-12)">
        <rect className="sa-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
        <path className="sa-art-icon-accent" d="M-11-1v11h22V-1M-13-1l3-9h20l3 9ZM-3 10V4h6v6" />
      </g>

      {/* Satellite: folder token */}
      <g transform="translate(380 236) rotate(9)">
        <rect className="sa-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
        <path className="sa-art-icon" d="M-11-8h7l3 3h12v13h-22Z" />
        <path className="sa-art-icon" d="M-11-1h22" />
      </g>

      {/* Cyan orb */}
      <circle className="sa-art-cyan-halo" cx="388" cy="118" r="11.5" />
      <circle className="sa-art-cyan" cx="388" cy="118" r="5.5" />
    </svg>
  );
}

/* ── Slide 4 · equipo: invite the administrators ────────────────────────────────── */

/*
 * Slide 4 · equipo: the super administrator invites the people who run each business. A Necto hub card (left)
 * sends invitations along dotted paths to administrator chips (right); a paper plane travels on the middle path,
 * the highlighted chip shows the cyan "Invitación enviada" state and a third chip waits for the next invite.
 * Satellites: an envelope token (top left) and a key token (right, below the chips).
 */

function EquipoArt() {
  return (
    <svg className="sa-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, sparks and base shadow */}
      <ArtOrbits />
      <ArtSpark cx={300} cy={48} size={14} />
      <ArtSpark cx={62} cy={262} size={9} />
      <ellipse className="sa-art-shadow" cx="230" cy="302" rx="122" ry="10" />

      {/* Invitation paths: hub → each administrator chip */}
      <path className="sa-art-link" strokeDasharray="1 4" d="M206 142Q228 112 254 104" />
      <path className="sa-art-link" strokeDasharray="1 4" d="M206 180Q222 178 246 180" />
      <path className="sa-art-link" strokeDasharray="1 4" d="M206 232Q228 250 250 248" />

      {/* Hub: the super administrator's space */}
      <g transform="rotate(-3 150 180)">
        <rect className="sa-art-card" x="96" y="100" width="108" height="170" rx="18" />
        <rect className="sa-art-orange-tint" x="110" y="114" width="30" height="30" rx="9" />
        <ArtMark x={114} y={118} size={22} />
        <text className="sa-art-label" x="110" y="162" fontSize="6">
          TU ESPACIO
        </text>
        <text className="sa-art-text" x="110" y="175" fontSize="11">
          Tu equipo
        </text>
        <path className="sa-art-rule" d="M110 186H190" />
        {/* Team list: one active member row and the pending invites row */}
        <circle className="sa-art-soft" cx="117" cy="202" r="6" />
        <rect className="sa-art-soft" x="128" y="198.5" width="44" height="3.5" rx="1.75" />
        <rect className="sa-art-soft" x="128" y="205" width="28" height="3" rx="1.5" />
        <circle className="sa-art-cyan" cx="186" cy="202" r="2.6" />
        <circle className="sa-art-orange-tint" cx="117" cy="220" r="6" />
        <circle className="sa-art-orange" cx="117" cy="220" r="2" />
        <text className="sa-art-text" x="128" y="222.5" fontSize="7">
          2 pendientes
        </text>
        {/* Invite button */}
        <rect className="sa-art-orange" x="110" y="236" width="80" height="20" rx="10" />
        <rect className="sa-art-on-accent" x="125.1" y="242.5" width="1.8" height="7" rx="0.9" />
        <rect className="sa-art-on-accent" x="122.5" y="245.1" width="7" height="1.8" rx="0.9" />
        <text className="sa-art-on-accent" x="135" y="248.6" fontSize="8" fontWeight="500">
          Invitar
        </text>
      </g>

      {/* Chip A: administrator with role pill */}
      <g transform="rotate(4 322 104)">
        <rect className="sa-art-card" x="254" y="78" width="136" height="52" rx="14" />
        <circle className="sa-art-soft" cx="278" cy="104" r="14" />
        <text className="sa-art-text" x="278" y="107" fontSize="8.5" textAnchor="middle">
          AG
        </text>
        <text className="sa-art-text" x="300" y="100" fontSize="8">
          ana@sol.co
        </text>
        <rect className="sa-art-soft" x="300" y="106" width="66" height="13" rx="6.5" />
        <text className="sa-art-label" x="306" y="114.6" fontSize="6">
          ADMINISTRADOR
        </text>
      </g>

      {/* Chip B: highlighted, invitation sent */}
      <g transform="rotate(-4 320 180)">
        <rect className="sa-art-card" x="246" y="152" width="144" height="58" rx="14" />
        <circle className="sa-art-orange-tint" cx="271" cy="174" r="14" />
        <text className="sa-art-orange" x="271" y="177" fontSize="8.5" fontWeight="500" textAnchor="middle">
          LM
        </text>
        <text className="sa-art-text" x="293" y="171" fontSize="8">
          luis@central.co
        </text>
        <rect className="sa-art-soft" x="293" y="179" width="80" height="15" rx="7.5" />
        <ArtCheckBadge cx={301} cy={186.5} r={5} />
        <text className="sa-art-text" x="310" y="189" fontSize="7">
          Invitación enviada
        </text>
      </g>

      {/* Chip C: solid card, dashed plus circle waiting for the next invite */}
      <g transform="rotate(3 293 248)">
        <rect className="sa-art-card" x="250" y="230" width="86" height="36" rx="12" />
        <circle className="sa-art-wire" cx="268" cy="248" r="9" strokeDasharray="2 2.7" />
        <path className="sa-art-icon" d="M268 244.5v7M264.5 248h7" />
        <rect className="sa-art-soft" x="283" y="243" width="40" height="3.5" rx="1.75" />
        <rect className="sa-art-soft" x="283" y="250" width="24" height="3" rx="1.5" />
      </g>

      {/* Paper plane travelling on the middle path */}
      <g transform="translate(225 178) rotate(-8)">
        <circle className="sa-art-card" r="13" />
        <path className="sa-art-icon-accent" d="M-6 0.5 6.5-5.5 2 6.5-0.5 1.5ZM-0.5 1.5 6.5-5.5" />
      </g>

      {/* Satellite: envelope token, clear of the hub corner */}
      <g transform="translate(70 82) rotate(-12)">
        <rect className="sa-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
        <rect className="sa-art-icon-accent" x="-12" y="-8.5" width="24" height="17" rx="3" />
        <path className="sa-art-icon-accent" d="m-11-6.5 11 8 11-8" />
        {/* Unread dot: invitations out */}
        <circle className="sa-art-card" cx="24" cy="-24" r="8" />
        <circle className="sa-art-orange" cx="24" cy="-24" r="5" />
      </g>

      {/* Satellite: key token (role access) */}
      <g transform="translate(382 254) rotate(9)">
        <rect className="sa-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
        <circle className="sa-art-icon" cx="-6" cy="0" r="6" />
        <path className="sa-art-icon" d="M0 0h13M9 0v4.5M13 0v3" />
      </g>

      {/* Cyan orb (left, balancing the chip column) */}
      <circle className="sa-art-cyan-halo" cx="78" cy="214" r="11.5" />
      <circle className="sa-art-cyan" cx="78" cy="214" r="5.5" />
    </svg>
  );
}

/* ── Slide 5 · modulos: activate the modules you need ───────────────────────────── */

/*
 * Slide 5 · modulos: a wide settings panel "Módulos del negocio" with a 2-column toggle list (glyph tile + name +
 * switch). Three modules are on (orange track, knob right), two are off (soft track, knob left). The last cell is an
 * empty dashed slot, and a tilted "Referidos · Nuevo" card floats above the panel's right edge, linked to the slot by
 * a dotted arc.
 * Satellites: a "modules" grid token (upper left) and a sparkle token with the scene's only check (lower right).
 */

interface ModuleCell {
  name: string;
  on: boolean;
  glyph: string;
}

const PANEL_X = 115;
const PANEL_Y = 100;
const PANEL_W = 230;
const PANEL_H = 150;
const PAD = 14;
const COL_W = 96;
const COL_GAP = 10;
const ROW_Y0 = 142;
const ROW_H = 34;

/* Glyphs drawn around (0,0), about 10 units wide. */
const CELLS: ModuleCell[] = [
  { name: "Pedidos", on: true, glyph: "M-5-1.5h10l-1 6.5h-8ZM-2.5-1.5v-1.5a2.5 2.5 0 0 1 5 0v1.5" },
  { name: "Agenda", on: true, glyph: "M-3-5h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2ZM-5-1h10M-2.5-6.5v2.5M2.5-6.5v2.5" },
  { name: "Reservas", on: false, glyph: "M-3.5-5h7v10l-3.5-2.6-3.5 2.6Z" },
  { name: "Inventario", on: true, glyph: "M-5-2.5 0-5l5 2.5v5L0 5l-5-2.5ZM-5-2.5 0 0l5-2.5M0 0v5" },
  { name: "Turnos", on: false, glyph: "M0-5a5 5 0 1 1 0 10a5 5 0 1 1 0-10ZM0-2.5V0l2 1.5" },
];

const cellX = (col: number) => PANEL_X + PAD + col * (COL_W + COL_GAP);
const cellCy = (row: number) => ROW_Y0 + row * ROW_H + ROW_H / 2;

function Cell({ cell, index }: { cell: ModuleCell; index: number }) {
  const x = cellX(index % 2);
  const cy = cellCy(Math.floor(index / 2));
  const tx = x + COL_W - 20; // toggle left edge
  return (
    <g>
      <rect className={cell.on ? "sa-art-orange-tint" : "sa-art-soft"} x={x} y={cy - 9} width="18" height="18" rx="6" />
      <path className={cell.on ? "sa-art-icon-accent" : "sa-art-icon"} transform={`translate(${x + 9} ${cy}) scale(0.78)`} d={cell.glyph} />
      <text className="sa-art-text" x={x + 24} y={cy + 2.8} fontSize="8" opacity={cell.on ? 1 : 0.6}>
        {cell.name}
      </text>
      {/* Toggle switch: orange track when on; soft track with a rule outline when off */}
      {cell.on ? (
        <>
          <rect className="sa-art-orange" x={tx} y={cy - 5.5} width="20" height="11" rx="5.5" />
          <circle className="sa-art-on-accent" cx={tx + 14.5} cy={cy} r="3.8" />
        </>
      ) : (
        <>
          <rect className="sa-art-soft" x={tx} y={cy - 5.5} width="20" height="11" rx="5.5" />
          <rect className="sa-art-rule" x={tx} y={cy - 5.5} width="20" height="11" rx="5.5" />
          <circle className="sa-art-ink" opacity="0.35" cx={tx + 5.5} cy={cy} r="3.8" />
        </>
      )}
    </g>
  );
}

function ModulosArt() {
  const slotX = cellX(1);
  const slotCy = cellCy(2);
  return (
    <svg className="sa-slide-art" viewBox="0 0 460 350" fill="none">
      {/* Background: orbits, dotted links, sparks and base shadow */}
      <ArtOrbits />
      <ArtSpark cx={196} cy={64} size={13} />
      <ArtSpark cx={412} cy={176} size={10} />
      <ellipse className="sa-art-shadow" cx="232" cy="300" rx="122" ry="10" />

      {/* Settings panel */}
      <g transform="rotate(-1.5 230 175)">
        <rect className="sa-art-card" x={PANEL_X} y={PANEL_Y} width={PANEL_W} height={PANEL_H} rx="18" />
        {/* Header: mark tile + label + title */}
        <rect className="sa-art-orange-tint" x={PANEL_X + PAD} y={PANEL_Y + 11} width="24" height="24" rx="8" />
        <ArtMark x={PANEL_X + PAD + 3.5} y={PANEL_Y + 14.5} size={17} />
        <text className="sa-art-label" x={PANEL_X + PAD + 32} y={PANEL_Y + 20} fontSize="6">
          AJUSTES · 3 ACTIVOS
        </text>
        <text className="sa-art-text" x={PANEL_X + PAD + 32} y={PANEL_Y + 32} fontSize="11">
          Módulos del negocio
        </text>
        <path className="sa-art-rule" d={`M${PANEL_X} ${ROW_Y0}H${PANEL_X + PANEL_W}`} />

        {/* Column divider and row rules */}
        <path className="sa-art-rule" d={`M${PANEL_X + PANEL_W / 2} ${ROW_Y0 + 8}V${PANEL_Y + PANEL_H - 10}`} />
        {[1, 2].map((r) => (
          <path
            key={r}
            className="sa-art-rule"
            d={`M${cellX(0)} ${ROW_Y0 + r * ROW_H}h${COL_W}M${cellX(1)} ${ROW_Y0 + r * ROW_H}h${COL_W}`}
          />
        ))}

        {CELLS.map((cell, i) => (
          <Cell key={cell.name} cell={cell} index={i} />
        ))}

        {/* Empty dashed slot waiting for the new module */}
        <rect className="sa-art-orange-tint sa-art-dash-accent" x={slotX - 2} y={slotCy - 11} width={COL_W + 4} height="22" rx="9" />
        <path className="sa-art-icon-accent" d={`M${slotX + COL_W / 2} ${slotCy - 4}v8M${slotX + COL_W / 2 - 4} ${slotCy}h8`} />
      </g>

      {/* Dotted arc from the floating card into the slot */}
      <path className="sa-art-link" strokeDasharray="1 4" d="M386 102Q408 176 356 213" />
      <path className="sa-art-link" d="M362 213.2 356 213l2-5.8" />

      {/* Floating module card, about to snap into the empty slot */}
      <g transform="translate(350 74) rotate(8)">
        <rect className="sa-art-card" x="-50" y="-23" width="104" height="46" rx="14" />
        <rect className="sa-art-orange-tint" x="-40" y="-13" width="26" height="26" rx="8" />
        {/* Share-nodes glyph */}
        <path className="sa-art-icon-accent" d="M-30.5-3.5l6-3M-30.5 3.5l6 3" />
        <circle className="sa-art-icon-accent" cx="-32" cy="0" r="2.6" />
        <circle className="sa-art-icon-accent" cx="-22.5" cy="-7" r="2.6" />
        <circle className="sa-art-icon-accent" cx="-22.5" cy="7" r="2.6" />
        <text className="sa-art-text" x="-6" y="-1" fontSize="11">
          Referidos
        </text>
        <rect className="sa-art-orange" x="-6" y="5" width="30" height="10" rx="5" />
        <text className="sa-art-on-accent" x="9" y="12.2" fontSize="6" textAnchor="middle" fontWeight="500" letterSpacing="0.08em">
          NUEVO
        </text>
      </g>

      {/* Satellite: modules grid token */}
      <g transform="translate(82 100) rotate(-12)">
        <rect className="sa-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
        <rect className="sa-art-icon" x="-10" y="-10" width="8.5" height="8.5" rx="2.5" />
        <rect className="sa-art-icon-accent" x="1.5" y="-10" width="8.5" height="8.5" rx="2.5" />
        <rect className="sa-art-icon" x="-10" y="1.5" width="8.5" height="8.5" rx="2.5" />
        <rect className="sa-art-icon" x="1.5" y="1.5" width="8.5" height="8.5" rx="2.5" />
      </g>

      {/* Satellite: sparkle token with check */}
      <g transform="translate(378 264) rotate(9)">
        <rect className="sa-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
        <path className="sa-art-icon" d="M-2-10l2.6 7.4L8 0l-7.4 2.6L-2 10l-2.6-7.4L-12 0l7.4-2.6Z" />
        <path className="sa-art-icon-accent" d="M8-12v5M5.5-9.5h5" />
      </g>
      <ArtCheckBadge cx={400} cy={242} r={7.5} />

      {/* Cyan orb */}
      <circle className="sa-art-cyan-halo" cx="88" cy="252" r="11.5" />
      <circle className="sa-art-cyan" cx="88" cy="252" r="5.5" />
    </svg>
  );
}

const ART: Record<RegisterSlideId, () => ReactNode> = {
  cuenta: CuentaArt,
  identidad: IdentityArt,
  negocios: NegociosArt,
  equipo: EquipoArt,
  modulos: ModulosArt,
};

/** The illustration of one register slide. */
export function RegisterSlideArt({ slide }: { slide: RegisterSlideId }) {
  const Art = ART[slide];
  return <Art />;
}
