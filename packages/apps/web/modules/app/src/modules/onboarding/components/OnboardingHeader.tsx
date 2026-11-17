import { NectoLogo } from "@/brand/NectoLogo";
import { ThemeIconButton } from "@/shell";

/** Cabecera de la bienvenida: logotipo Necto y cambio de tema. */
export function OnboardingHeader() {
  return (
    <header className="ob-header">
      <div className="ob-header-brand">
        <NectoLogo variant="full" width={154} height={22} />
      </div>
      <div className="ob-actions">
        <ThemeIconButton className="ob-icon-button" />
      </div>
    </header>
  );
}
