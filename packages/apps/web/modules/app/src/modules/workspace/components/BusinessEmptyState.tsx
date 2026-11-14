import { NectoLogo } from "@/brand/NectoLogo";
import { Button } from "@/elements/ui/button";

interface BusinessEmptyStateProps {
  onCreate: () => void;
  /** Plays the entrance animation again. */
  onReplay: () => void;
}

/**
 * Empty state of the directory: a shop that assembles itself with motion (awning, orbits, floating tokens and the
 * logo) and the invitation to create the first business. The animations live in `workspace.css` (`.ws-enter`).
 */
export function BusinessEmptyState({ onCreate, onReplay }: BusinessEmptyStateProps) {
  return (
    <div className="ws-empty">
      <button className="ws-motion-replay ws-icon-button" type="button" onClick={onReplay} aria-label="Repetir animación" title="Repetir animación">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="ws-empty-inner">
        <div className="ws-shop-motion" aria-hidden="true">
          <svg viewBox="0 0 360 250" fill="none">
            <ellipse cx="184" cy="226" rx="117" ry="11" className="ws-shop-shadow" />
            <circle cx="180" cy="134" r="104" className="ws-orbit" />
            <circle cx="180" cy="134" r="78" className="ws-orbit ws-orbit-inner" />
            <path d="M73 77Q64 173 137 208M290 160Q290 53 222 49" className="ws-motion-line" pathLength="1" />
            <g className="ws-float-one">
              <circle cx="73" cy="77" r="20" className="ws-motion-token" />
              <path d="M73 68v18m-9-9h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </g>
            <g className="ws-float-two">
              <circle cx="290" cy="160" r="15" className="ws-motion-cyan" />
              <path d="m284 160 4 4 8-8" stroke="#190088" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g className="ws-shop-building">
              <rect x="113" y="88" width="137" height="127" rx="13" className="ws-shop-wall" />
              <rect x="127" y="127" width="109" height="74" rx="4" className="ws-shop-window-bg" />
              <rect x="132" y="134" width="42" height="35" rx="6" className="ws-shop-window" />
              <path d="M153 134v35m-21-18h42" className="ws-shop-window-line" />
              <path d="M190 215v-72a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v72" className="ws-shop-door" />
              <circle cx="215" cy="176" r="2" className="ws-shop-door-knob" />
              <g className="ws-shop-awning">
                <path d="m117 73-14 28h157l-14-28a7 7 0 0 0-6-4H123a7 7 0 0 0-6 4Z" className="ws-shop-roof" />
                <path
                  d="M103 101v9a16 16 0 0 0 31 0 16 16 0 0 0 31 0 16 16 0 0 0 32 0 16 16 0 0 0 31 0 16 16 0 0 0 32 0v-9H103Z"
                  className="ws-shop-orange"
                />
                <path d="M134 101v9a16 16 0 0 0 31 0v-9m32 0v9a16 16 0 0 0 31 0v-9" className="ws-shop-stripes" />
                <path d="m138 69-4 32h31l1-32m30 0 1 32h31l-4-32" className="ws-shop-stripes" />
              </g>
              <path d="M104 216h155" className="ws-shop-ground" />
            </g>
            <g className="ws-float-three">
              <circle cx="253" cy="59" r="25" className="ws-shop-token-bg" />
            </g>
            <path d="m310 95 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" className="ws-spark" />
          </svg>
          <div className="ws-shop-logo-token">
            <NectoLogo variant="mark" width={64} height={64} />
          </div>
        </div>

        <div className="ws-empty-copy">
          <span className="ws-empty-eyebrow">UN NUEVO COMIENZO</span>
          <h3>Crea tu primer negocio</h3>
          <p>Agrega un negocio a tu workspace para empezar a organizar su información y su equipo.</p>
          <Button className="ws-primary" onClick={onCreate}>
            <span aria-hidden="true">+</span>Crear negocio
          </Button>
          <span className="ws-empty-footnote">Cada negocio tendrá su propio espacio.</span>
        </div>
      </div>
    </div>
  );
}
