import InteractiveDotGrid from "@/brand/InteractiveDotGrid";
import type { AccessView } from "../stores/adminAccess.store";
import { SlideArt, SlideIndicators, useBrandSlides, type SlideId } from "./BrandScenes";

interface BrandCopy {
  eyebrow: string;
  title: [string, string];
  description: [string, string];
}

/** The side panel changes its message with each step, as in the reference. */
const COPY: Record<SlideId, BrandCopy> = {
  acceso: {
    eyebrow: "MENOS PASOS. MÁS POSIBILIDADES.",
    title: ["Tu próxima conexión", "empieza aquí"],
    description: ["Entra a tu negocio sin contraseñas.", "Y dedica tu tiempo a hacerlo crecer."],
  },
  codigo: {
    eyebrow: "UN CÓDIGO. MUCHAS POSIBILIDADES.",
    title: ["Una conexión sencilla", "para un gran comienzo"],
    description: ["Verifica tu correo y sigue adelante.", "Tu negocio está cada vez más cerca."],
  },
  regreso: {
    eyebrow: "MÁS CERCA DE LO QUE IMPORTA.",
    title: ["Vuelve a lo que", "haces crecer"],
    description: ["Tu sesión te permite continuar.", "El siguiente paso ya es tuyo."],
  },
  negocios: {
    eyebrow: "UN ACCESO. TUS NEGOCIOS.",
    title: ["Cada negocio,", "una nueva posibilidad"],
    description: ["Todos tus espacios en un mismo lugar.", "Elige uno y sigamos creciendo."],
  },
  listo: {
    eyebrow: "TODO EMPIEZA CON UNA CONEXIÓN.",
    title: ["Conecta. Comparte.", "Sigue creciendo"],
    description: ["Las buenas conexiones abren puertas.", "Hoy comienza una nueva jornada."],
  },
};

interface BrandPanelProps {
  view: AccessView;
}

/**
 * The decorative brand panel: five static illustrations (`BrandScenes.tsx`) that rotate as slides with their copy,
 * over the white interactive dot background. It follows the active view of the form and can be changed with the
 * dots in the footer. Purely visual: the art and the copy are hidden from assistive technology except the dots.
 */
export function BrandPanel({ view }: BrandPanelProps) {
  const { index, slide, fadeState, select } = useBrandSlides(view === "loading" ? "acceso" : view);
  const copy = COPY[slide];
  const motionClass = fadeState === "out" ? "is-leaving" : "is-entering";
  return (
    <aside className="na-brand" aria-label="Necto, acceso sin contraseña">
      <InteractiveDotGrid
        dotGap={24}
        baseRadius={1.5}
        activeRadius={3.0}
        glowDistance={160}
        className="-z-10"
      />
      <div className="na-brand-content">
        <div className="na-motion-scene" aria-hidden="true">
          <div key={slide} className={`na-slide ${motionClass}`} data-slide={slide}>
            <SlideArt slide={slide} />
          </div>
        </div>
        <div key={slide} className={`na-brand-copy na-slide-copy ${motionClass}`}>
          <span>{copy.eyebrow}</span>
          <h2>
            {copy.title[0]}
            <br />
            {copy.title[1]}
            <span>.</span>
          </h2>
          <p>
            {copy.description[0]}
            <br />
            {copy.description[1]}
          </p>
        </div>
      </div>
      <footer className="na-brand-footer">
        <SlideIndicators activeIndex={index} onSelect={select} />
      </footer>
    </aside>
  );
}
