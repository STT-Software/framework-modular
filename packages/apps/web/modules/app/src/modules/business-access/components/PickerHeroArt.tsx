import { ArtMark, ArtSpark } from "@/brand/SceneArt";

interface PickerHeroArtProps {
  activeRole: "admin" | "operator" | null;
  hasAdmin: boolean;
  operatorCount: number;
}

/**
 * NECTO Flat Editorial Geometry hierarchy diagram for /business/access ("Elige tu negocio").
 * Top capsule: Administrador (parent) -> dashed drop into the isometric NECTO storefront ->
 * branching downward to Pedidos & Turnos capsules, all encircled by a subtle dotted orbit
 * with four-pointed vermilion sparkles and cyan check badges.
 */
export function PickerHeroArt({ activeRole }: PickerHeroArtProps) {
  const adminHighlighted = activeRole === "admin";
  const operatorHighlighted = activeRole === "operator";

  // 5 scalloped isometric awning stripes across the front-left facade of the centered shop
  const awningRibs = [0, 1, 2, 3, 4].map((i) => {
    const t0 = i / 5;
    const t1 = (i + 1) / 5;
    const tx0 = 159 + (235 - 159) * t0;
    const ty0 = 148 + (175 - 148) * t0;
    const tx1 = 159 + (235 - 159) * t1;
    const ty1 = 148 + (175 - 148) * t1;
    const bx0 = tx0 - 8;
    const by0 = ty0 + 17;
    const bx1 = tx1 - 8;
    const by1 = ty1 + 17;
    const cx = (bx0 + bx1) / 2 - 1.5;
    const cy = (by0 + by1) / 2 + 6.5;

    return {
      index: i,
      isOrange: i % 2 === 0,
      d: `M${tx0.toFixed(1)} ${ty0.toFixed(1)} L${tx1.toFixed(1)} ${ty1.toFixed(1)} L${bx1.toFixed(1)} ${by1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx0.toFixed(1)} ${by0.toFixed(1)} Z`,
    };
  });

  return (
    <svg
      className="np-hero-svg"
      viewBox="0 0 460 350"
      fill="none"
      role="img"
      aria-label="Jerarquía NECTO: Administrador conectado al negocio y ramificado hacia Pedidos y Turnos"
    >
      {/* Subtle dotted orbital backdrop */}
      <ellipse
        className="np-art-orbit"
        cx="232"
        cy="184"
        rx="142"
        ry="114"
        transform="rotate(-14 232 184)"
      />

      {/* Four-pointed vermilion sparkles */}
      <g className="np-art-sparks" aria-hidden="true">
        <ArtSpark cx={96} cy={104} size={16} />
        <ArtSpark cx={376} cy={176} size={13} />
      </g>

      {/* Soft ground shadow beneath isometric storefront */}
      <ellipse className="np-art-shadow" cx="228" cy="240" rx="82" ry="15" />

      {/* Dashed hierarchy connectors: Admin pill -> Shop -> Pedidos & Turnos pills */}
      <path
        className="np-art-tree-link"
        data-active={adminHighlighted || undefined}
        d="M230 78 V116"
      />
      <path
        className="np-art-tree-link"
        data-active={operatorHighlighted || undefined}
        d="M188 228 Q154 252 134 276"
      />
      <path
        className="np-art-tree-link"
        data-active={operatorHighlighted || undefined}
        d="M268 228 Q304 252 324 276"
      />

      {/* ── TOP PILL: Administrador (Parent Role) ── */}
      <g transform="translate(230 56)">
        <rect
          x="-92"
          y="-22"
          width="184"
          height="44"
          rx="22"
          className={adminHighlighted ? "np-art-pill is-highlighted" : "np-art-pill"}
        />
        {/* User silhouette icon */}
        <circle cx="-58" cy="-4.5" r="4.8" className="np-art-icon" />
        <path d="M-67 9 C-65.5 3 -50.5 3 -49 9" className="np-art-icon" />
        <text x="-38" y="4.5" className="np-art-pill-label">
          Administrador
        </text>
        {/* Cyan check badge on upper-right */}
        <g transform="translate(82 -16)">
          <circle r="11" className="np-art-badge-bg" />
          <path d="M-4 0.5 L-1 3.5 L4.5 -3" className="np-art-badge-check" />
        </g>
      </g>

      {/* ── CENTERPIECE: Isometric NECTO Storefront ── */}
      <g className="np-iso-shop">
        {/* Front-left white facade */}
        <path d="M164 158 L235 184 L235 241 L164 215 Z" className="np-iso-front-wall" />
        {/* Dark indigo display window */}
        <path d="M173 178 L200 188 L200 216 L173 206 Z" className="np-iso-dark-window" />
        {/* Entrance door */}
        <path d="M208 191 L226 198 L226 237 L208 230 Z" className="np-iso-door" />
        <circle cx="212.5" cy="215" r="1.4" className="np-art-indigo-dot" />

        {/* Right cyan side wall */}
        <path d="M235 184 L292 161 L292 218 L235 241 Z" className="np-iso-side-wall" />
        {/* White isometric side window */}
        <path d="M247 190 L279 177 L279 203 L247 216 Z" className="np-iso-side-window" />

        {/* Flat white isometric roof */}
        <path d="M159 148 L218 124 L295 151 L235 175 Z" className="np-iso-roof-top" />
        {/* Deep indigo right roof eave */}
        <path d="M235 175 L295 151 L295 161 L235 185 Z" className="np-iso-roof-edge" />

        {/* Striped vermilion & white awning */}
        {awningRibs.map((rib) => (
          <path
            key={rib.index}
            d={rib.d}
            className={rib.isOrange ? "np-iso-stripe-orange" : "np-iso-stripe-white"}
          />
        ))}

        {/* Rooftop NECTO N signboard */}
        <path d="M199 137 L241 120 L245 121.5 L203 138.5 Z" className="np-iso-roof-edge" />
        <path d="M240 80 L245 81.5 L245 121.5 L240 120 Z" className="np-iso-roof-edge" />
        <path d="M199 97 L240 80 L240 120 L199 137 Z" className="np-iso-sign-face" />
        <g transform="translate(211 103) skewY(-22.5)">
          <ArtMark x={0} y={0} size={18} />
        </g>
      </g>

      {/* ── LOWER-LEFT PILL: Pedidos (Subordinate Operator Module) ── */}
      <g transform="translate(122 298)">
        <rect
          x="-68"
          y="-20"
          width="136"
          height="40"
          rx="20"
          className={operatorHighlighted ? "np-art-pill is-highlighted-cyan" : "np-art-pill"}
        />
        {/* Shopping bag icon */}
        <path
          d="M-44 -5 H-30 L-29 8 H-45 L-44 -5 Z M-41 -5 V-7.5 A4 4 0 0 1 -33 -7.5 V-5"
          className="np-art-icon"
        />
        <text x="-18" y="4.5" className="np-art-pill-label">
          Pedidos
        </text>
        {/* Cyan check badge on upper-right */}
        <g transform="translate(58 -15)">
          <circle r="10.5" className="np-art-badge-bg" />
          <path d="M-3.8 0.5 L-1 3.3 L4.3 -2.8" className="np-art-badge-check" />
        </g>
      </g>

      {/* ── LOWER-RIGHT PILL: Turnos (Subordinate Operator Module) ── */}
      <g transform="translate(332 298)">
        <rect
          x="-66"
          y="-20"
          width="132"
          height="40"
          rx="20"
          className={operatorHighlighted ? "np-art-pill is-highlighted-cyan" : "np-art-pill"}
        />
        {/* Queue list icon */}
        <path d="M-37 -5 H-24 M-37 0 H-24 M-37 5 H-24" className="np-art-icon" />
        <circle cx="-42" cy="-5" r="1.4" className="np-art-indigo-dot" />
        <circle cx="-42" cy="0" r="1.4" className="np-art-indigo-dot" />
        <circle cx="-42" cy="5" r="1.4" className="np-art-indigo-dot" />
        <text x="-14" y="4.5" className="np-art-pill-label">
          Turnos
        </text>
        {/* Cyan check badge on upper-right */}
        <g transform="translate(56 -15)">
          <circle r="10.5" className="np-art-badge-bg" />
          <path d="M-3.8 0.5 L-1 3.3 L4.3 -2.8" className="np-art-badge-check" />
        </g>
      </g>
    </svg>
  );
}
