import { NectoLogo } from "@/brand/NectoLogo";
import type { AccessView } from "../stores/adminAccess.store";

interface BrandCopy {
  eyebrow: string;
  title: [string, string];
  description: [string, string];
  pass: string;
}

/** The side panel changes its message with each step, as in the reference. */
const COPY: Record<Exclude<AccessView, "loading">, BrandCopy> = {
  acceso: {
    eyebrow: "MENOS PASOS. MÁS POSIBILIDADES.",
    title: ["Tu próxima conexión", "empieza aquí"],
    description: ["Entra a tu negocio sin contraseñas.", "Y dedica tu tiempo a hacerlo crecer."],
    pass: "Sin contraseña",
  },
  codigo: {
    eyebrow: "UN CÓDIGO. MUCHAS POSIBILIDADES.",
    title: ["Una conexión sencilla", "para un gran comienzo"],
    description: ["Verifica tu correo y sigue adelante.", "Tu negocio está cada vez más cerca."],
    pass: "Sin contraseña",
  },
  regreso: {
    eyebrow: "MÁS CERCA DE LO QUE IMPORTA.",
    title: ["Vuelve a lo que", "haces crecer"],
    description: ["Tu sesión te permite continuar.", "El siguiente paso ya es tuyo."],
    pass: "Sesión vigente",
  },
  negocios: {
    eyebrow: "UN ACCESO. TUS NEGOCIOS.",
    title: ["Cada negocio,", "una nueva posibilidad"],
    description: ["Todos tus espacios en un mismo lugar.", "Elige uno y sigamos creciendo."],
    pass: "Correo verificado",
  },
  listo: {
    eyebrow: "TODO EMPIEZA CON UNA CONEXIÓN.",
    title: ["Conecta. Comparte.", "Sigue creciendo"],
    description: ["Las buenas conexiones abren puertas.", "Hoy comienza una nueva jornada."],
    pass: "Correo verificado",
  },
};

interface BrandPanelProps {
  view: AccessView;
  onReplay: () => void;
}

/** The decorative panel: a device that connects, an access pass and floating tokens. Purely visual. */
export function BrandPanel({ view, onReplay }: BrandPanelProps) {
  const copy = COPY[view === "loading" ? "acceso" : view];
  return (
    <aside className="na-brand" aria-label="Necto, acceso sin contraseña">
      <div className="na-brand-grid" aria-hidden="true" />
      <div className="na-brand-top">
        <span />
        EL PODER DE CONECTAR
      </div>
      <div className="na-brand-content">
        <div className="na-motion-scene" aria-hidden="true">
          <svg className="na-connections" viewBox="0 0 460 350" fill="none">
            <circle cx="230" cy="174" r="132" />
            <ellipse cx="230" cy="174" rx="176" ry="92" transform="rotate(-24 230 174)" />
            <path className="na-connection-line" d="M87 224Q121 89 294 79M363 139Q383 257 214 281" pathLength="1" />
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
              <strong>{copy.pass}</strong>
            </div>
            <span className="na-pass-check">
              <svg viewBox="0 0 24 24">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </span>
          </div>
          <span className="na-motion-token na-envelope-token">
            <svg viewBox="0 0 32 32">
              <rect x="4" y="7" width="24" height="18" rx="4" />
              <path d="m5 10 11 8 11-8" />
            </svg>
            <i />
          </span>
          <span className="na-motion-token na-lock-token">
            <svg viewBox="0 0 32 32">
              <rect x="7" y="14" width="18" height="14" rx="4" />
              <path d="M11 14V9a5 5 0 0 1 10 0v5m-5 6v3" />
            </svg>
          </span>
          <span className="na-orbit-dot" />
        </div>
        <div className="na-brand-copy">
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
        <span>Conecta. Comparte. Crece.</span>
        <button type="button" onClick={onReplay} aria-label="Repetir animación">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
          </svg>
        </button>
      </footer>
    </aside>
  );
}
