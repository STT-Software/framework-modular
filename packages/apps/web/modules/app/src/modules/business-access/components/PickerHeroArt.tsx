import { useId } from "react";
import { ArtMark, ArtSpark } from "@/brand/SceneArt";

interface PickerHeroArtProps {
  activeRole: "admin" | "operator" | null;
  hasAdmin: boolean;
  operatorCount: number;
}

/**
 * NECTO Flat Editorial Geometry composition for /business/access ("Elige tu negocio").
 * - Top centerpiece: slightly tilted white browser-style card ("ROL PRINCIPAL · Administrador")
 *   framed by warm cream (#EFE6D3) and cyan (#97D6DF) organic shapes, flat shadow, and 2 vermilion sparkles.
 * - Bottom row: two crisp white cards for subordinate operator modules ("Pedidos" and "Turnos")
 *   with cream icon tiles, vermilion arrows, and clipped cyan / cream+vermilion corner accents.
 */
export function PickerHeroArt({ activeRole }: PickerHeroArtProps) {
  const clipBase = useId();
  const pedidosClipId = `${clipBase}-pedidos-clip`;
  const turnosClipId = `${clipBase}-turnos-clip`;

  const adminHighlighted = activeRole === "admin";
  const operatorHighlighted = activeRole === "operator";

  return (
    <svg
      className="np-hero-svg"
      viewBox="0 0 540 368"
      fill="none"
      role="img"
      aria-label="Jerarquía NECTO: tarjeta principal de Administrador sobre los módulos subordinados de Pedidos y Turnos"
    >
      <defs>
        <clipPath id={pedidosClipId}>
          <rect x="6" y="244" width="256" height="114" rx="18" />
        </clipPath>
        <clipPath id={turnosClipId}>
          <rect x="278" y="244" width="256" height="114" rx="18" />
        </clipPath>
      </defs>

      {/* ── TOP BACKDROP: Organic Cream & Cyan Shapes + Flat Shadow + Sparkles ── */}
      <g aria-hidden="true">
        {/* Soft warm cream organic backdrop */}
        <path
          className="np-art-blob-cream"
          d="M118 76 C168 24 274 6 356 26 C428 44 446 112 406 164 C368 214 234 220 144 206 C76 196 58 138 118 76 Z"
        />
        {/* Soft cyan organic accent on bottom-right */}
        <ellipse
          className="np-art-blob-cyan"
          cx="392"
          cy="176"
          rx="62"
          ry="36"
          transform="rotate(-16 392 176)"
        />
        {/* Subtle flat ground shadow */}
        <ellipse className="np-art-shadow" cx="270" cy="214" rx="154" ry="8.5" />

        {/* Two four-pointed vermilion sparkles */}
        <g className="np-art-sparks">
          <ArtSpark cx={444} cy={40} size={26} />
          <ArtSpark cx={98} cy={150} size={20} />
        </g>
      </g>

      {/* ── CENTERPIECE CARD: ROL PRINCIPAL · Administrador (Slightly Tilted) ── */}
      <g transform="rotate(-2.2 270 116)">
        <rect
          x="120"
          y="32"
          width="300"
          height="168"
          rx="20"
          className={adminHighlighted ? "np-art-main-card is-highlighted" : "np-art-main-card"}
        />

        {/* Top browser header: NECTO N mark + 3 indigo hollow circles */}
        <ArtMark x={144} y={48} size={28} />
        <circle cx="352" cy="62" r="5.2" className="np-art-win-dot" />
        <circle cx="372" cy="62" r="5.2" className="np-art-win-dot" />
        <circle cx="392" cy="62" r="5.2" className="np-art-win-dot" />
        <line x1="121" y1="86" x2="419" y2="86" className="np-art-rule" />

        {/* Storefront icon inside warm cream tile */}
        <rect x="142" y="99" width="58" height="58" rx="15" className="np-art-chip-cream" />
        <g transform="translate(171 128)">
          {/* Storefront body */}
          <path
            d="M-13 1 V12 C-13 13.8 -11.5 15 -9.8 15 H9.8 C11.5 15 13 13.8 13 12 V1"
            className="np-art-shop-body"
          />
          {/* Vermilion scalloped awning */}
          <path
            d="M-13.5 -12 H13.5 L16.5 -2.5 C16.5 1 13.6 3.2 10.6 3.2 C8.5 3.2 6.8 2 5.6 0.4 C4.3 2.2 2.3 3.2 0 3.2 C-2.3 3.2 -4.3 2.2 -5.6 0.4 C-6.8 2 -8.5 3.2 -10.6 3.2 C-13.6 3.2 -16.5 1 -16.5 -2.5 Z"
            className="np-art-shop-awning"
          />
        </g>

        {/* Primary role copy */}
        <text x="214" y="113" className="np-art-eyebrow-text">
          ROL PRINCIPAL
        </text>
        <text x="214" y="135" className="np-art-main-title">
          Administrador
        </text>
        <text x="214" y="152" className="np-art-main-subtitle">
          Gestión y configuración del negocio.
        </text>

        {/* Minimal editorial skeleton bars */}
        <rect x="142" y="169" width="256" height="7" rx="3.5" className="np-art-bar" />
        <rect x="142" y="181" width="120" height="7" rx="3.5" className="np-art-bar" />
      </g>

      {/* ── BOTTOM ROW: Subordinate Module Cards (Pedidos & Turnos) ── */}
      {/* Left Card: Pedidos */}
      <g>
        <rect
          x="6"
          y="244"
          width="256"
          height="114"
          rx="18"
          className={operatorHighlighted ? "np-art-sub-card is-highlighted-cyan" : "np-art-sub-card"}
        />
        {/* Clipped cyan organic corner accent */}
        <g clipPath={`url(#${pedidosClipId})`} aria-hidden="true">
          <ellipse cx="238" cy="364" rx="46" ry="30" transform="rotate(-14 238 364)" className="np-art-corner-cyan" />
        </g>

        {/* Shopping bag tile */}
        <rect x="24" y="274" width="54" height="54" rx="14" className="np-art-chip-cream" />
        <g transform="translate(51 301)">
          <path
            d="M-9.5 -4.5 H9.5 L11.5 12 C11.6 13.2 10.6 14 9.5 14 H-9.5 C-10.6 14 -11.6 13.2 -11.5 12 Z M-5.5 -4.5 V-7.5 C-5.5 -10.8 -3 -13 0 -13 C3 -13 5.5 -10.8 5.5 -7.5 V-4.5"
            className="np-art-icon"
          />
        </g>

        {/* Pedidos copy */}
        <text x="92" y="287" className="np-art-sub-title">
          Pedidos
        </text>
        <text x="92" y="307" className="np-art-sub-desc">
          Gestión de solicitudes,
        </text>
        <text x="92" y="323" className="np-art-sub-desc">
          estados y entregas.
        </text>
      </g>

      {/* Right Card: Turnos */}
      <g>
        <rect
          x="278"
          y="244"
          width="256"
          height="114"
          rx="18"
          className={operatorHighlighted ? "np-art-sub-card is-highlighted-cyan" : "np-art-sub-card"}
        />
        {/* Clipped cream + vermilion organic corner accent */}
        <g clipPath={`url(#${turnosClipId})`} aria-hidden="true">
          <ellipse cx="492" cy="364" rx="44" ry="28" transform="rotate(-10 492 364)" className="np-art-corner-cream" />
          <ellipse cx="524" cy="358" rx="28" ry="24" transform="rotate(-18 524 358)" className="np-art-corner-orange" />
        </g>

        {/* Calendar / Queue tile */}
        <rect x="296" y="274" width="54" height="54" rx="14" className="np-art-chip-cream" />
        <g transform="translate(323 301)">
          <rect x="-11.5" y="-9.5" width="23" height="21" rx="4.5" className="np-art-icon" />
          <path d="M-11.5 -2.5 H11.5 M-5.5 -13 V-7.5 M5.5 -13 V-7.5 M-6 2.5 H2 M-6 7 H5" className="np-art-icon" />
        </g>

        {/* Turnos copy */}
        <text x="364" y="287" className="np-art-sub-title">
          Turnos
        </text>
        <text x="364" y="307" className="np-art-sub-desc">
          Control de filas y
        </text>
        <text x="364" y="323" className="np-art-sub-desc">
          llamados de atención.
        </text>
      </g>
    </svg>
  );
}
