import { useEffect, useState } from "react";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { useElementVisibility } from "@/hooks";
import "./workspace-announcement-banner.css";

export interface AnnouncementSlide {
  id: "connect" | "pipeline" | "team";
  eyebrow: string;
  titleLine1: string;
  titleHighlight: string;
  description: string;
  caption: string;
  badgeText?: string;
}

export interface WorkspaceAnnouncementBannerProps {
  slides?: readonly AnnouncementSlide[];
  intervalMs?: number;
}

const DEFAULT_SLIDES: readonly AnnouncementSlide[] = [
  {
    id: "connect",
    eyebrow: "UN ESPACIO. MUCHAS POSIBILIDADES.",
    titleLine1: "Todo lo que haces crecer,",
    titleHighlight: "mejor conectado.",
    description:
      "Tus modalidades de entrega, tu equipo y cada nueva orden sincronizados en un solo espacio. Elige dónde quieres comenzar hoy.",
    caption: "El poder de conectar",
  },
  {
    id: "pipeline",
    eyebrow: "ANUNCIO · FLUJO OPERATIVO POR ETAPAS",
    titleLine1: "De la confirmación al despacho,",
    titleHighlight: "con tiempos bajo control.",
    description:
      "Supervisa cada pedido desde que ingresa hasta su entrega, con tiempos objetivo (SLA), alertas de urgencia y reglas fuera de horario.",
    caption: "Tiempos y etapas en sincronía",
  },
  {
    id: "team",
    eyebrow: "NOVEDAD · EQUIPO Y ACCESO COMPARTIDO",
    titleLine1: "Cada operador en su etapa,",
    titleHighlight: "con un solo acceso seguro.",
    description:
      "Vincula personal existente de tu negocio en un clic. Tu equipo entra sin contraseñas mediante código único por correo a sus etapas asignadas.",
    caption: "Tu equipo listo para operar",
  },
];

/**
 * Slide 1 Vector: Clean Necto Orbital Ecosystem Hub (Pure Vector, RegisterScenes style)
 */
function ConnectOrbitVector({ caption }: { caption: string }) {
  return (
    <div className="wab-art" aria-hidden="true">
      <svg viewBox="0 0 390 250" fill="none" className="wab-svg">
        {/* Soft ground shadow */}
        <ellipse cx="195" cy="222" rx="82" ry="6" className="wab-svg-shadow" />

        {/* Orbits */}
        <circle cx="195" cy="118" r="88" className="wab-orbit-dashed" />
        <ellipse
          cx="195"
          cy="118"
          rx="142"
          ry="60"
          transform="rotate(-18 195 118)"
          className="wab-orbit-solid"
        />

        {/* Satellite 1: Top (Orders / Pipeline List) */}
        <g className="wab-svg-token">
          <rect x="126" y="24" width="38" height="38" rx="12" className="wab-svg-card" />
          <path d="M136 38h18M136 43h18M136 48h11" stroke="#ff3f1a" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Satellite 2: Left (Modules Grid) */}
        <g className="wab-svg-token">
          <rect x="42" y="96" width="38" height="38" rx="12" className="wab-svg-card" />
          <rect x="50" y="104" width="8" height="8" rx="2" stroke="#190088" strokeWidth="1.6" fill="none" />
          <rect x="62" y="104" width="8" height="8" rx="2" stroke="#190088" strokeWidth="1.6" fill="none" />
          <rect x="50" y="116" width="8" height="8" rx="2" stroke="#190088" strokeWidth="1.6" fill="none" />
          <rect x="62" y="116" width="8" height="8" rx="2" stroke="#190088" strokeWidth="1.6" fill="none" />
        </g>

        {/* Satellite 3: Right (Bag / Delivery) */}
        <g className="wab-svg-token">
          <rect x="310" y="66" width="38" height="38" rx="12" className="wab-svg-card" />
          <path
            d="M321 78h16l1 14h-18l1-14Zm3 0v-2.5a3 3 0 0 1 6 0v2.5"
            stroke="#190088"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* Satellite 4: Bottom-Left (Verification / Ready) */}
        <g className="wab-svg-token">
          <rect x="110" y="160" width="38" height="38" rx="12" className="wab-svg-card" />
          <circle cx="129" cy="179" r="9" stroke="#0e7090" strokeWidth="1.6" fill="none" />
          <path d="m125 179 2.5 2.5 5-5" stroke="#0e7090" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Satellite 5: Bottom-Right (Team / Operators) */}
        <g className="wab-svg-token">
          <rect x="254" y="146" width="38" height="38" rx="12" className="wab-svg-card" />
          <path d="M265 170v-1.5a3.5 3.5 0 0 1 3.5-3.5h5a3.5 3.5 0 0 1 3.5 3.5v1.5" stroke="#027a48" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <circle cx="271" cy="159" r="3.5" stroke="#027a48" strokeWidth="1.6" fill="none" />
          <path d="M280 170v-1a3 3 0 0 0-2.5-2.9M277 156a3 3 0 0 1 0 6" stroke="#027a48" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>

        {/* Central Card with Canonical Necto Mark (pure SVG, rotated -6 deg around 195 116) */}
        <g className="wab-center-card-group" transform="rotate(-6 195 116)">
          <rect x="151" y="71" width="88" height="90" rx="24" className="wab-svg-card" />
          <g transform="translate(173, 94) scale(1.83)">
            {/* Orange N mark */}
            <path
              d="M22.4171 19.1921L19.5245 22.1622C18.9564 22.7461 18.0008 22.7715 17.4068 22.1622L9.16827 14.064C8.23853 13.1501 6.63731 13.7848 6.63731 15.1049V21.0453C6.63731 21.8576 5.96583 22.4923 5.16522 22.4923H1.47209C0.645653 22.4923 0 21.8322 0 21.0453V5.3819C0 5.0011 0.154957 4.62031 0.439044 4.34106L3.43487 1.39625C4.00305 0.837748 4.90696 0.837748 5.50096 1.37086L22.3654 17.1104C22.9594 17.6689 22.9852 18.5828 22.4171 19.1667V19.1921Z"
              fill="#FF3F1A"
              stroke="none"
            />
            {/* Indigo corner mark */}
            <path
              d="M22.8045 1.92936V4.29029C22.8045 5.12803 22.0555 5.83885 21.1258 5.83885H15.3149C13.8428 5.83885 13.0938 4.21413 14.1269 3.22406L16.6062 0.863135C16.9161 0.558499 17.3551 0.406181 17.7942 0.406181H21.1258C22.0555 0.406181 22.8045 1.09161 22.8045 1.95475V1.92936Z"
              fill="#190088"
              stroke="none"
            />
          </g>
        </g>
      </svg>

      <span className="wab-caption">{caption}</span>
    </div>
  );
}

/**
 * Slide 2 Vector: Clean Order Pipeline, SLA Timer & Dispatch Card (RegisterScenes style)
 */
function PipelineSlaVector({ caption }: { caption: string }) {
  return (
    <div className="wab-art" aria-hidden="true">
      <svg viewBox="0 0 390 250" fill="none" className="wab-svg">
        {/* Soft backdrop orbits */}
        <circle cx="195" cy="118" r="92" className="wab-orbit-dashed" />
        <path
          d="M58 148C86 72 304 68 332 142"
          className="wab-orbit-solid"
          strokeLinecap="round"
        />
        <ellipse cx="195" cy="222" rx="92" ry="6" className="wab-shadow" />

        {/* Main Order Pipeline Card */}
        <g className="wab-card-group">
          <rect x="88" y="48" width="214" height="134" rx="22" className="wab-svg-card" />

          {/* Top header inside card: order badge + SLA pill */}
          <rect x="108" y="66" width="36" height="36" rx="11" className="wab-svg-tint-indigo" />
          <path
            d="M120 80h12l1 11h-14l1-11Zm3 0v-2a3 3 0 0 1 6 0v2"
            className="wab-svg-stroke-indigo"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="154" y="72" width="66" height="8" rx="4" className="wab-svg-bar-strong" />
          <rect x="154" y="86" width="44" height="6" rx="3" className="wab-svg-bar-muted" />

          {/* Orange SLA badge on top-right of card */}
          <rect x="236" y="68" width="48" height="22" rx="11" className="wab-svg-tint-orange" />
          <circle cx="247" cy="79" r="3" className="wab-svg-fill-orange" />
          <rect x="254" y="76" width="22" height="6" rx="3" className="wab-svg-fill-orange" />

          {/* 3-stage connected pipeline track inside card */}
          <line x1="126" y1="134" x2="264" y2="134" className="wab-svg-track-line" strokeWidth="2.5" />
          <line x1="126" y1="134" x2="210" y2="134" className="wab-svg-track-active" strokeWidth="2.5" />

          {/* Stage 1 node: Confirmación (completed) */}
          <circle cx="126" cy="134" r="14" className="wab-svg-fill-indigo" />
          <path
            d="m121 134 3.2 3.2 6.8-6.8"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Stage 2 node: Preparación (active orange) */}
          <circle cx="195" cy="134" r="14" className="wab-svg-fill-orange" />
          <path
            d="M195 128v6l4 2.5"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Stage 3 node: Despacho (ready cyan/indigo) */}
          <circle cx="264" cy="134" r="14" className="wab-svg-node-idle" />
          <path
            d="m260 134 3 3 5-6"
            className="wab-svg-stroke-indigo"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Bottom labels under stages */}
          <rect x="108" y="158" width="36" height="6" rx="3" className="wab-svg-bar-muted" />
          <rect x="177" y="158" width="36" height="6" rx="3" className="wab-svg-fill-orange" opacity="0.75" />
          <rect x="246" y="158" width="36" height="6" rx="3" className="wab-svg-bar-muted" />
        </g>

        {/* Floating left satellite card: SLA Clock */}
        <g className="wab-float-left">
          <rect x="34" y="88" width="46" height="46" rx="15" className="wab-svg-card" />
          <circle cx="57" cy="111" r="11" className="wab-svg-stroke-indigo" strokeWidth="1.7" />
          <path d="M57 105v6l4 2" className="wab-svg-stroke-orange" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Floating right satellite card: Delivery / Check */}
        <g className="wab-float-right">
          <rect x="310" y="76" width="46" height="46" rx="15" className="wab-svg-card" />
          <circle cx="333" cy="99" r="12" className="wab-svg-fill-cyan" opacity="0.28" />
          <path
            d="m328 99 3.5 3.5 6.5-7"
            className="wab-svg-stroke-indigo"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <span className="wab-caption">{caption}</span>
    </div>
  );
}

/**
 * Slide 3 Vector: Clean Team & Shared OTP Role Shield Vector (RegisterScenes style)
 */
function TeamAccessVector({ caption }: { caption: string }) {
  return (
    <div className="wab-art" aria-hidden="true">
      <svg viewBox="0 0 390 250" fill="none" className="wab-svg">
        <circle cx="195" cy="118" r="90" className="wab-orbit-dashed" />
        <ellipse
          cx="195"
          cy="118"
          rx="140"
          ry="58"
          transform="rotate(14 195 118)"
          className="wab-orbit-solid"
        />
        <ellipse cx="195" cy="222" rx="86" ry="6" className="wab-shadow" />

        {/* Connecting lines between shield hub and team cards */}
        <path d="M135 92L172 110M255 92L218 110M195 142V168" className="wab-svg-track-line" strokeWidth="2" />

        {/* Left operator card */}
        <g className="wab-float-left">
          <rect x="46" y="54" width="92" height="64" rx="16" className="wab-svg-card" />
          <circle cx="72" cy="86" r="14" className="wab-svg-tint-indigo" />
          <circle cx="72" cy="82" r="4.5" className="wab-svg-stroke-indigo" strokeWidth="1.6" />
          <path d="M64 94c1.8-3.5 14.2-3.5 16 0" className="wab-svg-stroke-indigo" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="94" y="76" width="32" height="7" rx="3.5" className="wab-svg-bar-strong" />
          <rect x="94" y="89" width="24" height="5" rx="2.5" className="wab-svg-fill-cyan" />
        </g>

        {/* Right operator card */}
        <g className="wab-float-right">
          <rect x="252" y="54" width="92" height="64" rx="16" className="wab-svg-card" />
          <circle cx="278" cy="86" r="14" className="wab-svg-tint-orange" />
          <circle cx="278" cy="82" r="4.5" className="wab-svg-stroke-orange" strokeWidth="1.6" />
          <path d="M270 94c1.8-3.5 14.2-3.5 16 0" className="wab-svg-stroke-orange" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="300" y="76" width="32" height="7" rx="3.5" className="wab-svg-bar-strong" />
          <rect x="300" y="89" width="24" height="5" rx="2.5" className="wab-svg-fill-orange" opacity="0.75" />
        </g>

        {/* Center Shield Hub Card */}
        <g className="wab-card-group">
          <rect x="155" y="72" width="80" height="82" rx="24" className="wab-svg-card" />
          <path
            d="M195 90 175 98v15c0 12.5 20 21 20 21s20-8.5 20-21V98l-20-8Z"
            className="wab-svg-tint-indigo"
          />
          <path
            d="M195 90 175 98v15c0 12.5 20 21 20 21s20-8.5 20-21V98l-20-8Z"
            className="wab-svg-stroke-indigo"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="m187 112 5.5 5.5 11-11"
            className="wab-svg-stroke-orange"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Bottom verified OTP access pill */}
        <g>
          <rect x="126" y="166" width="138" height="34" rx="17" className="wab-svg-card" />
          <circle cx="146" cy="183" r="8" className="wab-svg-fill-indigo" />
          <path d="m142.5 183 2.5 2.5 5-5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="162" y="179" width="58" height="7" rx="3.5" className="wab-svg-bar-strong" />
          <circle cx="246" cy="183" r="4" className="wab-svg-fill-orange" />
        </g>
      </svg>
      <span className="wab-caption">{caption}</span>
    </div>
  );
}

export function WorkspaceAnnouncementBanner({
  slides = DEFAULT_SLIDES,
  intervalMs = 5600,
}: WorkspaceAnnouncementBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pausedByHover, setPausedByHover] = useState(false);
  const { ref: bannerRef, isVisible } = useElementVisibility<HTMLElement>();

  useEffect(() => {
    if (slides.length <= 1 || pausedByHover || !isVisible) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      setActiveIndex((prev) => (prev + 1) % slides.length);
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, pausedByHover, isVisible, intervalMs]);

  const current = slides[activeIndex] ?? slides[0];

  return (
    <section
      ref={bannerRef}
      className="wab-hero"
      aria-label="Anuncios y novedades del espacio de trabajo"
      onMouseEnter={() => setPausedByHover(true)}
      onMouseLeave={() => setPausedByHover(false)}
    >
      <BrandCardDecor />

      <div className="wab-copy">
        <div className="wab-eyebrow-row">
          <span className="wab-eyebrow">
            <i aria-hidden="true" />
            {current.eyebrow}
          </span>
        </div>

        <div key={current.id} className="wab-slide-text">
          <h2 className="wab-title">
            {current.titleLine1}
            <br />
            <span>{current.titleHighlight}</span>
          </h2>
          <p className="wab-desc">{current.description}</p>
        </div>

        {slides.length > 1 && (
          <div className="wab-dots" role="tablist" aria-label="Seleccionar anuncio">
            {slides.map((slide, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Anuncio ${idx + 1}: ${slide.titleLine1} ${slide.titleHighlight}`}
                  className={`wab-dot${isActive ? " is-active" : ""}`}
                  onClick={() => setActiveIndex(idx)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div key={current.id} className="wab-art-col">
        {current.id === "connect" && <ConnectOrbitVector caption={current.caption} />}
        {current.id === "pipeline" && <PipelineSlaVector caption={current.caption} />}
        {current.id === "team" && <TeamAccessVector caption={current.caption} />}
      </div>
    </section>
  );
}
