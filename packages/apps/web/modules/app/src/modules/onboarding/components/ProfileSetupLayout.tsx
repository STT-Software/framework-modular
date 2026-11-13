import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/profile-setup.css";
import type { ReactNode } from "react";
import { PageMeta } from "@/shell/meta";
import { cn } from "@/utils";
import { OnboardingLogo } from "./OnboardingLogo";
import { ThemeIconButton } from "./ThemeIconButton";

const TOTAL_STEPS = 2;

interface ProfileSetupLayoutProps {
  /** Paso actual (1 = teléfono, 2 = dónde nos conociste). */
  step: 1 | 2;
  /** Título de la pestaña del navegador. */
  title: string;
  /** Id del título de la pantalla, para `aria-labelledby`. */
  headingId: string;
  /** El panel del paso 1 es más angosto que el del paso 2. */
  width: "narrow" | "wide";
  children: ReactNode;
}

/** Marco de los pasos de perfil: logotipo, tema, progreso "Paso N de 2" y pie. */
export function ProfileSetupLayout({ step, title, headingId, width, children }: ProfileSetupLayoutProps) {
  return (
    <main className="ob-setup">
      <PageMeta title={title} />
      <header className="ob-setup-header">
        <div className="ob-setup-logo">
          <OnboardingLogo width={161} height={23} />
        </div>
        <ThemeIconButton className="ob-setup-theme" />
      </header>
      <section
        className={cn("ob-setup-panel", width === "narrow" ? "ob-setup-panel-phone" : "ob-setup-panel-source")}
        aria-labelledby={headingId}
      >
        <div className="ob-setup-progress-caption">
          <span>COMPLETA TU PERFIL</span>
          <span>
            Paso {step} de {TOTAL_STEPS}
          </span>
        </div>
        <div
          className="ob-setup-progress"
          role="progressbar"
          aria-label={`Paso ${step} de ${TOTAL_STEPS}`}
          aria-valuemin={0}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <i key={i} className={i < step ? "is-done" : undefined} />
          ))}
        </div>
        {children}
      </section>
      <footer className="ob-setup-footer">Conecta. Comparte. Crece.</footer>
    </main>
  );
}
