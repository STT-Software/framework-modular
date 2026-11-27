import type { KeyboardEvent } from "react";
import { ArtMark, ArtSpark } from "@/brand/SceneArt";
import { moduleInfo } from "@/modules/businesses";

export interface HeroSatelliteModule {
  id: string;
  name: string;
  ready: boolean;
}

interface SetupHeroArtProps {
  businessName: string;
  verified: boolean;
  modules: readonly HeroSatelliteModule[];
  activeModuleId: string | null;
  saving: boolean;
  onHighlight: (moduleId: string | null, viaKeyboard?: boolean) => void;
  onSelectModule: (moduleId: string) => void;
}

interface SatelliteSlot {
  x: number;
  y: number;
  link: string;
}

/**
 * Curated right-side cyan satellite slots around the isometric storefront (viewBox 460x246).
 * Matches the asymmetric two-node layout in the NECTO banner and scales gracefully from 1 to 6 modules.
 */
function getSatelliteSlots(count: number): readonly SatelliteSlot[] {
  if (count === 1) {
    return [{ x: 378, y: 112, link: "M272 90 Q320 66 350 96" }];
  }
  if (count === 2) {
    return [
      { x: 368, y: 66, link: "M264 82 Q306 50 340 58" },
      { x: 394, y: 162, link: "M314 190 Q348 188 368 176" },
    ];
  }
  if (count === 3) {
    return [
      { x: 368, y: 54, link: "M264 80 Q306 46 340 52" },
      { x: 404, y: 122, link: "M294 128 Q344 116 376 122" },
      { x: 382, y: 190, link: "M314 194 Q344 198 356 192" },
    ];
  }
  const allSlots: SatelliteSlot[] = [
    { x: 368, y: 48, link: "M264 78 Q304 42 340 46" },
    { x: 410, y: 108, link: "M294 120 Q346 102 382 108" },
    { x: 392, y: 174, link: "M314 188 Q348 186 364 176" },
    { x: 76, y: 94, link: "M138 112 Q112 94 104 94" },
    { x: 82, y: 172, link: "M142 174 Q116 180 110 174" },
    { x: 336, y: 212, link: "M304 202 Q316 212 318 212" },
  ];
  return allSlots.slice(0, count);
}

/**
 * Slide 1 Art — NECTO Isometric Flat-Editorial Storefront.
 * Exact parallel isometric axes: front-left (+1, +0.36), right-side (+1, -0.41).
 */
export function SetupHeroArt({
  businessName,
  verified,
  modules,
  activeModuleId,
  saving,
  onHighlight,
  onSelectModule,
}: SetupHeroArtProps) {
  const slots = getSatelliteSlots(modules.length);

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, moduleId: string) => {
    if (saving) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectModule(moduleId);
    }
  };

  // 5 scalloped isometric awning stripes overhanging the front-left facade
  const awningRibs = [0, 1, 2, 3, 4].map((i) => {
    const t0 = i / 5;
    const t1 = (i + 1) / 5;
    const tx0 = 136 + (228 - 136) * t0;
    const ty0 = 108 + (141 - 108) * t0;
    const tx1 = 136 + (228 - 136) * t1;
    const ty1 = 108 + (141 - 108) * t1;
    const bx0 = tx0 - 11;
    const by0 = ty0 + 21;
    const bx1 = tx1 - 11;
    const by1 = ty1 + 21;
    const cx = (bx0 + bx1) / 2 - 2;
    const cy = (by0 + by1) / 2 + 8.5;

    return {
      index: i,
      isOrange: i % 2 === 0,
      d: `M${tx0.toFixed(1)} ${ty0.toFixed(1)} L${tx1.toFixed(1)} ${ty1.toFixed(1)} L${bx1.toFixed(1)} ${by1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx0.toFixed(1)} ${by0.toFixed(1)} Z`,
    };
  });

  return (
    <svg
      className="sh-hero-svg"
      viewBox="0 0 460 246"
      fill="none"
      role={modules.length > 0 ? "group" : "img"}
      aria-label={`Ilustración del espacio de trabajo de ${businessName}`}
    >
      <ellipse cx="212" cy="212" rx="96" ry="18" className="sh-art-shadow" />
      <path d="M126 172 C76 148, 80 90, 152 74" className="sh-art-orbit" />

      <g className="sh-art-sparks" aria-hidden="true">
        <ArtSpark cx={138} cy={52} size={15} />
        <ArtSpark cx={434} cy={104} size={14} />
      </g>

      {modules.map((mod, idx) => {
        const slot = slots[idx];
        if (!slot) return null;
        const isActive = activeModuleId === mod.id;
        return (
          <path
            key={`link-${mod.id}`}
            d={slot.link}
            className="sh-art-link"
            data-active={isActive || undefined}
            data-dimmed={Boolean(activeModuleId) && !isActive ? "true" : undefined}
          />
        );
      })}

      <g className="sh-iso-shop">
        {/* Front-left white facade */}
        <path d="M142 120 L228 151 L228 220 L142 189 Z" className="sh-iso-front-wall" />
        {/* Dark indigo storefront display window */}
        <path d="M153 144 L186 156 L186 190 L153 178 Z" className="sh-iso-dark-window" />
        {/* Entrance door */}
        <path d="M196 160 L218 168 L218 216 L196 208 Z" className="sh-iso-door" />
        <circle cx="201.5" cy="189" r="1.7" className="sh-art-ink-fill" />

        {/* Right cyan side wall */}
        <path d="M228 151 L296 123 L296 192 L228 220 Z" className="sh-iso-side-wall" />
        {/* Crisp white isometric side window */}
        <path d="M242 158 L280 142 L280 174 L242 190 Z" className="sh-iso-side-window" />

        {/* Flat white isometric roof */}
        <path d="M136 108 L208 78 L300 111 L228 141 Z" className="sh-iso-roof-top" />
        {/* Deep indigo right eave trim */}
        <path d="M228 141 L300 111 L300 123 L228 153 Z" className="sh-iso-roof-edge" />

        {/* Curved striped vermilion & white awning */}
        <g className="sh-art-awning">
          {awningRibs.map((rib) => (
            <path
              key={rib.index}
              d={rib.d}
              className={rib.isOrange ? "sh-art-stripe-orange" : "sh-art-stripe-white"}
            />
          ))}
        </g>

        {/* Isometric rooftop signboard with NECTO N mark */}
        <g className="sh-iso-sign">
          <path d="M185 95 L235 74 L240 76 L190 97 Z" className="sh-iso-roof-edge" />
          <path d="M234 25 L240 27 L240 76 L234 74 Z" className="sh-iso-roof-edge" />
          <path d="M185 46 L234 25 L234 74 L185 95 Z" className="sh-iso-sign-face" />
          <g transform="translate(199 53) skewY(-23)">
            <ArtMark x={0} y={0} size={22} />
          </g>
        </g>
      </g>

      {/* Cyan verified seal + 3 celebration ticks */}
      <g
        transform="translate(292 188)"
        className="sh-art-seal"
        data-verified={verified || undefined}
        aria-hidden="true"
      >
        <circle r="20.5" className="sh-art-seal-body" />
        <path d="M-7.5 1 L-2 6.5 L8.5 -5.5" className="sh-art-seal-check" />
        <path d="M12 -25 L16 -33 M21 -18 L29 -24 M25 -8 L34 -10" className="sh-art-seal-rays" />
      </g>

      {/* Connected Interactive Cyan Module Satellite Tiles */}
      {modules.map((mod, idx) => {
        const slot = slots[idx];
        if (!slot) return null;
        const info = moduleInfo(mod.id);
        const isActive = activeModuleId === mod.id;

        return (
          <g
            key={mod.id}
            transform={`translate(${slot.x} ${slot.y})`}
            role="button"
            tabIndex={saving ? -1 : 0}
            aria-disabled={saving || undefined}
            aria-label={`${mod.name}: ${mod.ready ? "Configurado" : "Por configurar"}`}
            className="sh-art-satellite"
            data-active={isActive || undefined}
            data-ready={mod.ready || undefined}
            onMouseEnter={() => onHighlight(mod.id, false)}
            onMouseLeave={() => onHighlight(null, false)}
            onFocus={() => onHighlight(mod.id, true)}
            onBlur={() => onHighlight(null, true)}
            onClick={() => {
              if (!saving) onSelectModule(mod.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, mod.id)}
          >
            <rect x="-25" y="-25" width="50" height="50" rx="13" className="sh-art-sat-box" />
            {info ? (
              <svg
                x="-12"
                y="-12"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sh-art-sat-icon"
                dangerouslySetInnerHTML={{ __html: info.icon }}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Slide 2 Art — NECTO Connected Operations Board (RegisterScenes editorial craft + matching cyan satellites).
 * Real Spanish micro-typography, live queue ticket A-04, active order #024 with vermilion SLA bar,
 * floating "Sin demoras" toast, and matching right-side cyan satellites.
 */
export function OperationsHeroArt() {
  return (
    <svg
      className="sh-hero-svg"
      viewBox="0 0 460 246"
      fill="none"
      role="img"
      aria-label="Ilustración de flujo operativo conectado en NECTO"
    >
      {/* Ground shadow & dotted orbital arc */}
      <ellipse cx="212" cy="214" rx="106" ry="16" className="sh-art-shadow" />
      <path d="M108 176 C68 144, 76 80, 148 64" className="sh-art-orbit" />

      {/* Vermilion 4-pointed sparkles */}
      <g className="sh-art-sparks" aria-hidden="true">
        <ArtSpark cx={110} cy={46} size={15} />
        <ArtSpark cx={434} cy={112} size={14} />
      </g>

      {/* Curved dotted links to right-side cyan satellites */}
      <path d="M294 82 Q324 56 344 64" className="sh-art-link" />
      <path d="M312 186 Q346 184 368 172" className="sh-art-link" />

      {/* Central tilted Operations Board */}
      <g transform="translate(206 122) rotate(-3)">
        {/* Crisp indigo depth shadow edge */}
        <rect x="-89" y="-68" width="186" height="146" rx="16" className="sh-art-card-depth" />
        {/* Main white editorial card */}
        <rect x="-94" y="-73" width="186" height="146" rx="16" className="sh-iso-front-wall" />

        {/* Card Header: Necto N tile + live status */}
        <rect x="-80" y="-60" width="26" height="26" rx="8" className="sh-art-orange-tint" />
        <ArtMark x={-76} y={-56} size={18} />
        <text x="-46" y="-50" className="sh-art-svg-label">
          OPERACIÓN EN VIVO
        </text>
        <text x="-46" y="-37" className="sh-art-svg-title">
          Pulso del día
        </text>
        {/* Live cyan pill */}
        <rect x="44" y="-54" width="36" height="16" rx="8" className="sh-iso-side-wall" />
        <circle cx="52" cy="-46" r="2.6" className="sh-art-ink-fill" />
        <text x="58" y="-43.5" className="sh-art-svg-micro">
          Vivo
        </text>

        <path d="M-80 -25 H78" className="sh-art-svg-rule" />

        {/* Row 1: Queue ticket A-04 */}
        <rect x="-80" y="-15" width="158" height="32" rx="9" className="sh-art-row-soft" />
        <rect x="-73" y="-8" width="32" height="18" rx="6" className="sh-art-stripe-orange" />
        <text x="-57" y="4" textAnchor="middle" className="sh-art-svg-on-accent">
          A-04
        </text>
        <text x="-34" y="-1" className="sh-art-svg-row-title">
          Turno en atención
        </text>
        <text x="-34" y="10" className="sh-art-svg-sub">
          Fila principal · Caja 1
        </text>
        <circle cx="66" cy="1" r="7.5" className="sh-art-seal-body-sm" />
        <path d="M63 1 L65.2 3.2 L69.5 -1.4" className="sh-art-seal-check-sm" />

        {/* Row 2: Order #024 with progress bar */}
        <rect x="-80" y="25" width="158" height="36" rx="9" className="sh-iso-side-wall" />
        <rect x="-73" y="32" width="32" height="18" rx="6" className="sh-art-ink-fill" />
        <text x="-57" y="44" textAnchor="middle" className="sh-art-svg-on-accent">
          #024
        </text>
        <text x="-34" y="39" className="sh-art-svg-row-title">
          Pedido en despacho
        </text>
        {/* Crisp SLA progress track */}
        <rect x="-34" y="46" width="102" height="5.5" rx="2.75" className="sh-art-track-bg" />
        <rect x="-34" y="46" width="72" height="5.5" rx="2.75" className="sh-art-stripe-orange-flat" />
      </g>

      {/* Floating overlapping toast (upper-left corner) */}
      <g transform="translate(106 58) rotate(-5)">
        <rect x="-48" y="-17" width="96" height="34" rx="11" className="sh-iso-front-wall" />
        <circle cx="-30" cy="0" r="8.5" className="sh-art-seal-body-sm" />
        <path d="M-33.5 0.5 L-31 3 L-26.2 -2.2" className="sh-art-seal-check-sm" />
        <text x="-16" y="-2.5" className="sh-art-svg-label">
          ESTADO
        </text>
        <text x="-16" y="8" className="sh-art-svg-row-title">
          Sin demoras
        </text>
      </g>

      {/* Cyan verified seal + 3 celebration ticks at bottom-right of board */}
      <g transform="translate(292 184)" className="sh-art-seal" data-verified="true" aria-hidden="true">
        <circle r="19.5" className="sh-art-seal-body" />
        <path d="M-7 1 L-1.8 6.2 L8 -5.2" className="sh-art-seal-check" />
        <path d="M12 -24 L16 -31 M20 -17 L28 -23 M24 -7 L33 -9" className="sh-art-seal-rays" />
      </g>

      {/* Upper-right cyan satellite: Queue / Ticket Bell */}
      <g transform="translate(370 66)">
        <rect x="-25" y="-25" width="50" height="50" rx="13" className="sh-art-sat-box" />
        <path
          d="M-9 6 H9 M-7 6 V-1 A7 7 0 0 1 7 -1 V6 M0 -8 V-10 M-2.5 9 A2.5 2.5 0 0 0 2.5 9"
          className="sh-art-sat-stroke"
        />
      </g>

      {/* Lower-right cyan satellite: Delivery Box / Dispatch */}
      <g transform="translate(394 162)">
        <rect x="-25" y="-25" width="50" height="50" rx="13" className="sh-art-sat-box" />
        <path
          d="M0 -10 L10 -5 V6 L0 11 L-10 6 V-5 Z M0 0 V11 M-10 -5 L0 0 L10 -5 M-5 -7.5 L5 -2.5"
          className="sh-art-sat-stroke"
        />
      </g>
    </svg>
  );
}

/**
 * Slide 3 Art — NECTO Centralized Schedule & Passwordless Team OTP Access.
 * Real Spanish micro-typography, 7-day weekly indicator, 6-digit OTP strip,
 * floating "Sin contraseñas" chip, and matching right-side cyan satellites.
 */
export function TeamScheduleHeroArt() {
  const weekDays = [
    { l: "L", open: true },
    { l: "M", open: true },
    { l: "X", open: true },
    { l: "J", open: true },
    { l: "V", open: true },
    { l: "S", open: true },
    { l: "D", open: false },
  ];
  const otpDigits = ["4", "8", "2", "9", "1", "6"];

  return (
    <svg
      className="sh-hero-svg"
      viewBox="0 0 460 246"
      fill="none"
      role="img"
      aria-label="Ilustración de horarios base y acceso seguro del equipo en NECTO"
    >
      {/* Ground shadow & dotted orbital arc */}
      <ellipse cx="212" cy="214" rx="106" ry="16" className="sh-art-shadow" />
      <path d="M108 176 C68 144, 76 80, 148 64" className="sh-art-orbit" />

      {/* Vermilion 4-pointed sparkles */}
      <g className="sh-art-sparks" aria-hidden="true">
        <ArtSpark cx={116} cy={46} size={15} />
        <ArtSpark cx={434} cy={112} size={14} />
      </g>

      {/* Curved dotted links to right-side cyan satellites */}
      <path d="M294 82 Q324 56 344 64" className="sh-art-link" />
      <path d="M312 186 Q346 184 368 172" className="sh-art-link" />

      {/* Central tilted Team & Schedule Card */}
      <g transform="translate(206 122) rotate(-3)">
        <rect x="-89" y="-68" width="186" height="146" rx="16" className="sh-art-card-depth" />
        <rect x="-94" y="-73" width="186" height="146" rx="16" className="sh-iso-front-wall" />

        {/* Card Header */}
        <rect x="-80" y="-60" width="26" height="26" rx="8" className="sh-art-orange-tint" />
        <ArtMark x={-76} y={-56} size={18} />
        <text x="-46" y="-50" className="sh-art-svg-label">
          ACCESO Y HORARIO
        </text>
        <text x="-46" y="-37" className="sh-art-svg-title">
          Equipo conectado
        </text>

        <path d="M-80 -25 H78" className="sh-art-svg-rule" />

        {/* Section 1: Base schedule & 7-day strip */}
        <text x="-80" y="-12" className="sh-art-svg-label">
          HORARIO BASE
        </text>
        <text x="78" y="-12" textAnchor="end" className="sh-art-svg-row-title">
          08:00 – 18:00
        </text>

        {weekDays.map((d, idx) => {
          const x = -80 + idx * 23;
          return (
            <g key={d.l}>
              <rect
                x={x}
                y="-5"
                width="19"
                height="19"
                rx="5.5"
                className={d.open ? "sh-iso-side-wall" : "sh-art-row-soft"}
              />
              <text
                x={x + 9.5}
                y="7.5"
                textAnchor="middle"
                className={d.open ? "sh-art-svg-day-open" : "sh-art-svg-day-off"}
              >
                {d.l}
              </text>
            </g>
          );
        })}

        {/* Section 2: Passwordless OTP Strip */}
        <text x="-80" y="31" className="sh-art-svg-label">
          CÓDIGO DE ACCESO POR CORREO
        </text>

        {otpDigits.map((digit, idx) => {
          const x = -80 + idx * 27;
          const isHighlight = idx === 0;
          return (
            <g key={idx}>
              <rect
                x={x}
                y="37"
                width="22"
                height="24"
                rx="6"
                className={isHighlight ? "sh-art-otp-active" : "sh-art-otp-cell"}
              />
              <text
                x={x + 11}
                y="53"
                textAnchor="middle"
                className={isHighlight ? "sh-art-svg-otp-accent" : "sh-art-svg-otp"}
              >
                {digit}
              </text>
            </g>
          );
        })}
      </g>

      {/* Floating overlapping chip (lower-left corner) */}
      <g transform="translate(106 184) rotate(-5)">
        <rect x="-54" y="-17" width="108" height="34" rx="11" className="sh-iso-front-wall" />
        <circle cx="-35" cy="0" r="9.5" className="sh-art-orange-tint" />
        <path
          d="M-35 -5.5 L-30 -3.5 V0.5 C-30 3.8 -32.2 6 -35 7 C-37.8 6 -40 3.8 -40 0.5 V-3.5 Z"
          className="sh-art-shield-accent"
        />
        <text x="-20" y="-2.5" className="sh-art-svg-label">
          OPERADOR
        </text>
        <text x="-20" y="8" className="sh-art-svg-row-title">
          Sin contraseñas
        </text>
      </g>

      {/* Cyan verified seal + 3 celebration ticks at bottom-right of card */}
      <g transform="translate(292 184)" className="sh-art-seal" data-verified="true" aria-hidden="true">
        <circle r="19.5" className="sh-art-seal-body" />
        <path d="M-7 1 L-1.8 6.2 L8 -5.2" className="sh-art-seal-check" />
        <path d="M12 -24 L16 -31 M20 -17 L28 -23 M24 -7 L33 -9" className="sh-art-seal-rays" />
      </g>

      {/* Upper-right cyan satellite: Schedule clock */}
      <g transform="translate(370 66)">
        <rect x="-25" y="-25" width="50" height="50" rx="13" className="sh-art-sat-box" />
        <circle cx="0" cy="0" r="10.5" className="sh-art-sat-stroke" />
        <path d="M0 -5.5 V0 L4 2.5" className="sh-art-sat-stroke" />
      </g>

      {/* Lower-right cyan satellite: Operator profile */}
      <g transform="translate(394 162)">
        <rect x="-25" y="-25" width="50" height="50" rx="13" className="sh-art-sat-box" />
        <circle cx="0" cy="-4.5" r="4.5" className="sh-art-sat-stroke" />
        <path d="M-9 9 C-7.5 3.5 7.5 3.5 9 9" className="sh-art-sat-stroke" />
      </g>
    </svg>
  );
}
