import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "./logoPaths";

interface OnboardingLogoProps {
  /** "full": logotipo completo con lema. "mark": solo la marca (la N con su esquina). */
  variant?: "full" | "mark";
  width: number;
  height: number;
}

/**
 * Logotipo de Necto para la bienvenida. Los colores salen de `onboarding.css`: en tema oscuro
 * el índigo (#190088) pasa a blanco y el naranja se mantiene.
 */
export function OnboardingLogo({ variant = "full", width, height }: OnboardingLogoProps) {
  const full = variant === "full";
  const paths = full ? LOGO_PATHS : LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);
  return (
    <svg
      width={width}
      height={height}
      viewBox={full ? "0 0 161 23" : "0 0 24 24"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Necto, grow together"
    >
      {paths.map((path, i) => (
        <path key={i} d={path.d} fill={path.fill} />
      ))}
    </svg>
  );
}
