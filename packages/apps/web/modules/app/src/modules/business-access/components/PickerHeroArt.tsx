import { ArtCheckBadge, ArtMark, ArtSpark } from "@/brand/SceneArt";

interface PickerHeroArtProps {
  activeRole: "admin" | "operator" | null;
  hasAdmin: boolean;
  operatorCount: number;
}

/**
 * NECTO Flat Editorial Geometry illustration for /business/access ("Elige tu negocio").
 * Visually communicates the real NECTO hierarchy:
 *   Top parent card (Administrador · Negocio) connected downward via dotted links
 *   to subordinate operator module tokens (Pedidos, Turnos) below.
 * Strictly follows SceneArt / RegisterScenes rules (viewBox 460x310, white cards 1.3px,
 * 1.5px round-cap icons, dotted orbit + tilted ellipse, 4-pointed sparkles, ArtMark & ArtCheckBadge).
 */
export function PickerHeroArt({ activeRole, hasAdmin, operatorCount }: PickerHeroArtProps) {
  const adminHighlighted = activeRole === "admin";
  const operatorHighlighted = activeRole === "operator";

  return (
    <svg
      className="np-hero-svg"
      viewBox="0 0 460 310"
      fill="none"
      role="img"
      aria-label="Ilustración editorial de la jerarquía de accesos: administración principal y módulos operativos subordinados"
    >
      {/* Background orbits, four-pointed sparkles and elliptical base shadow */}
      <circle className="np-art-orbit" cx="230" cy="152" r="118" />
      <ellipse
        className="np-art-orbit-solid"
        cx="230"
        cy="152"
        rx="178"
        ry="82"
        transform="rotate(-22 230 152)"
      />
      <g className="np-art-sparks" aria-hidden="true">
        <ArtSpark cx={382} cy={58} size={13} />
        <ArtSpark cx={76} cy={138} size={11} />
        <ArtSpark cx={392} cy={226} size={10} />
      </g>
      <ellipse className="np-art-shadow" cx="230" cy="278" rx="124" ry="9" />

      {/* Hierarchical dotted connection tree: Parent Admin Hub → Subordinate Operator Nodes */}
      <path
        className="np-art-tree-link"
        data-active={operatorHighlighted || undefined}
        d="M230 154 V178 M230 178 C230 190 152 184 152 204 M230 178 C230 190 308 184 308 204"
      />
      {/* Junction node on parent-child branch */}
      <circle
        className={operatorHighlighted ? "np-art-junction is-active" : "np-art-junction"}
        cx="230"
        cy="178"
        r="4"
      />

      {/* PARENT CARD (top center, subtle -2.5 deg tilt): Business Administration */}
      <g transform="translate(230 98) rotate(-2.5)">
        <rect
          className={adminHighlighted ? "np-art-card is-highlighted" : "np-art-card"}
          x="-110"
          y="-54"
          width="220"
          height="108"
          rx="16"
        />
        {/* Top warm cream header strip inside parent card */}
        <rect className="np-art-cream-tint" x="-96" y="-40" width="32" height="32" rx="10" />
        <ArtMark x={-90} y={-34} size={20} />

        <text className="np-art-label" x="-54" y="-28">
          ROL PRINCIPAL
        </text>
        <text className="np-art-title" x="-54" y="-13">
          Administrador
        </text>

        {/* Orange active dot pill */}
        <rect className="np-art-orange-tint" x="54" y="-36" width="42" height="18" rx="9" />
        <circle className="np-art-orange-dot" cx="64" cy="-27" r="3" />
        <text className="np-art-pill-accent" x="71" y="-24.5">
          Base
        </text>

        <path className="np-art-rule" d="M-96 2 H96" />

        {/* Mini business control summary */}
        <g transform="translate(-86 22)">
          <rect className="np-art-soft" x="-10" y="-11" width="20" height="20" rx="6" />
          <path className="np-art-mini-stroke" d="M-4.5 2.5h9M-3.5 -2.5v5M3.5 -2.5v5M-5 -2.5l5-3 5 3" />
        </g>
        <text className="np-art-row-title" x="-66" y="21">
          Gestión y Configuración
        </text>
        <text className="np-art-row-sub" x="-66" y="32">
          {hasAdmin ? "Control total del negocio" : "Negocio centralizado"}
        </text>
      </g>

      {/* Cyan verified seal on upper-right corner of parent card */}
      <g className="np-art-check-wrap" aria-hidden="true">
        <ArtCheckBadge cx={336} cy={46} r={11} />
      </g>

      {/* CHILD NODE 1 (lower-left): Subordinate Module — Pedidos */}
      <g transform="translate(148 232) rotate(-3)">
        <rect
          className={operatorHighlighted ? "np-art-card is-highlighted-cyan" : "np-art-card"}
          x="-70"
          y="-28"
          width="140"
          height="56"
          rx="14"
        />
        <rect className="np-art-cyan-soft" x="-58" y="-16" width="32" height="32" rx="9" />
        <path
          className="np-art-icon"
          d="M-48 -4 H-36 L-35 7 H-49 L-48 -4 Z M-45.5 -4 V-6 A3.5 3.5 0 0 1 -38.5 -6 V-4"
        />
        <text className="np-art-label" x="-18" y="-5">
          OPERADOR
        </text>
        <text className="np-art-row-title" x="-18" y="8">
          Pedidos
        </text>
      </g>

      {/* CHILD NODE 2 (lower-right): Subordinate Module — Turnos */}
      <g transform="translate(312 232) rotate(3)">
        <rect
          className={operatorHighlighted ? "np-art-card is-highlighted-cyan" : "np-art-card"}
          x="-70"
          y="-28"
          width="140"
          height="56"
          rx="14"
        />
        <rect className="np-art-cyan-soft" x="-58" y="-16" width="32" height="32" rx="9" />
        <path
          className="np-art-icon"
          d="M-45 -5 H-36 M-45 0 H-36 M-45 5 H-36"
        />
        <circle className="np-art-indigo-dot" cx="-49" cy="-5" r="1.2" />
        <circle className="np-art-indigo-dot" cx="-49" cy="0" r="1.2" />
        <circle className="np-art-indigo-dot" cx="-49" cy="5" r="1.2" />
        <text className="np-art-label" x="-18" y="-5">
          OPERADOR
        </text>
        <text className="np-art-row-title" x="-18" y="8">
          {operatorCount > 0 ? "Turnos" : "Módulos"}
        </text>
      </g>

      {/* Floating cyan halo orb */}
      <circle className="np-art-cyan-halo" cx="84" cy="222" r="10" />
      <circle className="np-art-cyan-dot" cx="84" cy="222" r="4.5" />
    </svg>
  );
}
