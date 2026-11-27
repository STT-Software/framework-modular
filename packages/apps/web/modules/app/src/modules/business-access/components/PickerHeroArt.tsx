import { ArtMark, ArtSpark } from "@/brand/SceneArt";

interface PickerHeroArtProps {
  activeRole: "admin" | "operator" | null;
  hasAdmin: boolean;
  operatorCount: number;
}

/**
 * NECTO Flat Editorial Geometry hierarchy composition for /business/access ("Elige tu negocio").
 * Follows the exact SceneArt / BrandScenes visual language:
 * - Layered backdrop: dotted circle + tilted ellipse orbit, cyan halo orbs, vermilion 4-pointed sparkles, flat shadow.
 * - Top card (Parent): Administrador with crown/shield chip and cyan check badge.
 * - Centerpiece Hub: NECTO Business card with stylized editorial storefront awning, ArtMark, and flanking config/catalog satellites.
 * - Bottom branch (Children): Pedidos & Turnos operator cards linked via curved dashed hierarchy paths.
 */
export function PickerHeroArt({ activeRole }: PickerHeroArtProps) {
  const adminHighlighted = activeRole === "admin";
  const operatorHighlighted = activeRole === "operator";

  return (
    <svg
      className="np-hero-svg"
      viewBox="0 0 460 364"
      fill="none"
      role="img"
      aria-label="Jerarquía NECTO: Administrador conectado al negocio central y ramificado hacia los módulos subordinados de Pedidos y Turnos"
    >
      {/* ── LAYER 1: Orbital Backdrop (SceneArt language) ── */}
      <circle className="np-art-orbit" cx="230" cy="182" r="142" />
      <ellipse
        className="np-art-orbit-solid"
        cx="230"
        cy="182"
        rx="196"
        ry="98"
        transform="rotate(-20 230 182)"
      />

      {/* Cyan accent orbs with soft halos */}
      <g aria-hidden="true">
        <circle className="np-art-cyan-halo" cx="42" cy="238" r="12" />
        <circle className="np-art-badge-bg" cx="42" cy="238" r="5.5" />
        <circle className="np-art-cyan-halo" cx="412" cy="90" r="10.5" />
        <circle className="np-art-badge-bg" cx="412" cy="90" r="4.8" />
      </g>

      {/* Four-pointed sparkles */}
      <g className="np-art-sparks" aria-hidden="true">
        <ArtSpark cx={72} cy={62} size={18} />
        <ArtSpark cx={396} cy={246} size={14} />
      </g>
      <g className="np-art-sparks-cyan" aria-hidden="true">
        <ArtSpark cx={364} cy={42} size={12} />
      </g>

      {/* Flat ground shadow */}
      <ellipse className="np-art-shadow" cx="230" cy="352" rx="168" ry="8.5" />

      {/* ── LAYER 2: Hierarchy Connectors & Satellite Links ── */}
      {/* Admin -> Business Hub */}
      <path
        className="np-art-tree-link"
        data-active={adminHighlighted || undefined}
        d="M230 72 V112"
      />
      <circle
        cx="230"
        cy="92"
        r="3.5"
        className={adminHighlighted ? "np-art-node-active" : "np-art-node"}
      />

      {/* Side satellites -> Business Hub */}
      <path className="np-art-sat-link" d="M77 160 Q95 166 113 166" />
      <path className="np-art-sat-link" d="M383 176 Q365 176 347 174" />

      {/* Business Hub -> Subordinate Operator Modules */}
      <path
        className="np-art-tree-link"
        data-active={operatorHighlighted || undefined}
        d="M230 232 C230 258 118 246 118 276"
      />
      <path
        className="np-art-tree-link"
        data-active={operatorHighlighted || undefined}
        d="M230 232 C230 258 342 246 342 276"
      />
      <circle
        cx="230"
        cy="232"
        r="5"
        className={operatorHighlighted ? "np-art-node-active" : "np-art-node"}
      />

      {/* ── LAYER 3: Flanking Satellites (Catalog & Team/Config) ── */}
      {/* Left satellite: Catalog / Inventory token */}
      <g transform="translate(52 156) rotate(-10)">
        <rect x="-24" y="-24" width="48" height="48" rx="15" className="np-art-card" />
        <rect x="-15" y="-15" width="30" height="30" rx="9" className="np-art-chip-cream" />
        <path
          className="np-art-icon"
          d="M-7 -4 L0 -8 L7 -4 V4 L0 8 L-7 4 Z M-7 -4 L0 0 L7 -4 M0 0 V8"
        />
      </g>

      {/* Right satellite: Team / Config settings token */}
      <g transform="translate(408 176) rotate(9)">
        <rect x="-24" y="-24" width="48" height="48" rx="15" className="np-art-card" />
        <rect x="-15" y="-15" width="30" height="30" rx="9" className="np-art-chip-cyan" />
        <circle cx="0" cy="0" r="4" className="np-art-icon" />
        <path
          className="np-art-icon"
          d="M0 -8.5 V-6.5 M0 6.5 V8.5 M-8.5 0 H-6.5 M6.5 0 H8.5 M-6 -6 L-4.5 -4.5 M4.5 4.5 L6 6 M6 -6 L4.5 -4.5 M-4.5 4.5 L-6 6"
        />
      </g>

      {/* ── LAYER 4: Top Parent Card — Administrador ── */}
      <g transform="translate(230 42)">
        <rect
          x="-116"
          y="-29"
          width="232"
          height="58"
          rx="18"
          className={adminHighlighted ? "np-art-card is-highlighted" : "np-art-card"}
        />
        {/* Icon chip */}
        <rect
          x="-103"
          y="-18"
          width="36"
          height="36"
          rx="11"
          className={adminHighlighted ? "np-art-chip-orange" : "np-art-chip-cream"}
        />
        {/* Admin user + shield glyph */}
        <circle cx="-85" cy="-4.5" r="4.6" className={adminHighlighted ? "np-art-icon-accent" : "np-art-icon"} />
        <path
          d="M-93.5 8.5 C-92 2.5 -78 2.5 -76.5 8.5"
          className={adminHighlighted ? "np-art-icon-accent" : "np-art-icon"}
        />
        {/* Copy */}
        <text x="-56" y="-4" className="np-art-eyebrow-text">
          ROL PRINCIPAL
        </text>
        <text x="-56" y="12.5" className="np-art-card-title">
          Administrador
        </text>
        {/* Cyan check badge */}
        <g transform="translate(108 -22)">
          <circle r="13.5" className="np-art-cyan-halo" />
          <circle r="10.5" className="np-art-badge-bg" />
          <path d="M-4 0.5 L-1 3.5 L4.5 -3" className="np-art-badge-check" />
        </g>
      </g>

      {/* ── LAYER 5: Centerpiece Hero Card — Negocio Central NECTO ── */}
      <g transform="translate(230 172) rotate(-2)">
        {/* Outer editorial card */}
        <rect
          x="-118"
          y="-58"
          width="236"
          height="116"
          rx="20"
          className={adminHighlighted ? "np-art-hub is-highlighted" : "np-art-hub"}
        />

        {/* Stylized flat-editorial storefront awning strip along the top edge */}
        <g transform="translate(-104 -46)">
          <rect x="0" y="0" width="38" height="14" rx="5" className="np-art-awning-orange" />
          <rect x="42" y="0" width="38" height="14" rx="5" className="np-art-awning-cream" />
          <rect x="84" y="0" width="40" height="14" rx="5" className="np-art-awning-orange" />
          <rect x="128" y="0" width="38" height="14" rx="5" className="np-art-awning-cream" />
          <rect x="170" y="0" width="38" height="14" rx="5" className="np-art-awning-orange" />
        </g>

        {/* NECTO Brand Mark tile */}
        <rect x="-102" y="-18" width="48" height="48" rx="14" className="np-art-chip-orange" />
        <ArtMark x={-91} y={-7} size={26} />

        {/* Hub copy */}
        <text x="-42" y="-3" className="np-art-eyebrow-text">
          NEGOCIO CENTRAL
        </text>
        <text x="-42" y="13.5" className="np-art-hub-title">
          Gestión y Config.
        </text>
        <text x="-42" y="28" className="np-art-meta-text">
          Catálogo · Equipo · Módulos
        </text>

        {/* Editorial divider & live status footer */}
        <line x1="-102" y1="40" x2="102" y2="40" className="np-art-rule" />
        <g transform="translate(-102 47)">
          <circle cx="4" cy="2" r="3" className="np-art-dot-orange" />
          <circle cx="14" cy="2" r="3" className="np-art-badge-bg" />
          <circle cx="24" cy="2" r="3" className="np-art-indigo-dot" />
          <text x="36" y="5" className="np-art-eyebrow-text">
            CONTROL COMPLETO
          </text>
        </g>
        {/* Right-aligned mini status pill */}
        <rect x="46" y="43.5" width="56" height="11" rx="5.5" className="np-art-chip-cyan" />
        <text x="74" y="51.2" textAnchor="middle" className="np-art-pill-micro">
          EN LÍNEA
        </text>
      </g>

      {/* ── LAYER 6: Subordinate Child Cards — Pedidos & Turnos ── */}
      {/* Bottom-left: Pedidos */}
      <g transform="translate(116 308) rotate(-2)">
        <rect
          x="-90"
          y="-30"
          width="180"
          height="60"
          rx="16"
          className={operatorHighlighted ? "np-art-card is-highlighted-cyan" : "np-art-card"}
        />
        <rect x="-78" y="-18" width="36" height="36" rx="10" className="np-art-chip-cyan" />
        {/* Shopping bag icon */}
        <path
          d="M-66.5 -4.5 H-53.5 L-52.5 8 H-67.5 L-66.5 -4.5 Z M-63.5 -4.5 V-7.2 A3.5 3.5 0 0 1 -56.5 -7.2 V-4.5"
          className="np-art-icon"
        />
        <text x="-32" y="-4" className="np-art-eyebrow-text">
          OPERADOR
        </text>
        <text x="-32" y="12.5" className="np-art-card-title">
          Pedidos
        </text>
        <g transform="translate(82 -24)">
          <circle r="12.5" className="np-art-cyan-halo" />
          <circle r="10" className="np-art-badge-bg" />
          <path d="M-3.8 0.5 L-1 3.3 L4.3 -2.8" className="np-art-badge-check" />
        </g>
      </g>

      {/* Bottom-right: Turnos */}
      <g transform="translate(344 308) rotate(2)">
        <rect
          x="-90"
          y="-30"
          width="180"
          height="60"
          rx="16"
          className={operatorHighlighted ? "np-art-card is-highlighted-cyan" : "np-art-card"}
        />
        <rect x="-78" y="-18" width="36" height="36" rx="10" className="np-art-chip-cyan" />
        {/* Queue list icon */}
        <path d="M-61 -5.5 H-51 M-61 0 H-51 M-61 5.5 H-51" className="np-art-icon" />
        <circle cx="-66" cy="-5.5" r="1.4" className="np-art-indigo-dot" />
        <circle cx="-66" cy="0" r="1.4" className="np-art-indigo-dot" />
        <circle cx="-66" cy="5.5" r="1.4" className="np-art-indigo-dot" />
        <text x="-32" y="-4" className="np-art-eyebrow-text">
          OPERADOR
        </text>
        <text x="-32" y="12.5" className="np-art-card-title">
          Turnos
        </text>
        <g transform="translate(82 -24)">
          <circle r="12.5" className="np-art-cyan-halo" />
          <circle r="10" className="np-art-badge-bg" />
          <path d="M-3.8 0.5 L-1 3.3 L4.3 -2.8" className="np-art-badge-check" />
        </g>
      </g>
    </svg>
  );
}
