import { ThemeIconButton } from "./ThemeIconButton";

/** Cabecera de la bienvenida: etiqueta de la edición y cambio de tema. */
export function OnboardingHeader() {
  return (
    <header className="ob-header">
      <div className="ob-edition">
        <span aria-hidden="true" />
        <span className="ob-edition-long">TU PRIMERA CONEXIÓN</span>
        <span className="ob-edition-short">NECTO</span>
      </div>
      <div className="ob-actions">
        <ThemeIconButton className="ob-icon-button" />
      </div>
    </header>
  );
}
