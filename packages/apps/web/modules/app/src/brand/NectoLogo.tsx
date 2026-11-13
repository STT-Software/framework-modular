import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "./logoPaths";

interface NectoLogoProps {
  /** "full": logotipo completo con lema. "mark": solo la marca (la N con su esquina). */
  variant?: "full" | "mark";
  width: number;
  height: number;
}

/**
 * Logotipo vectorial de Necto ("grow together"), de la base común. Los trazos llevan su color en el atributo
 * `fill` (índigo #190088 y naranja #FF3F1A): cada pantalla que lo usa lo recolorea en CSS según su tema, por ejemplo
 * pasando el índigo a blanco en modo oscuro con un selector `path[fill="#190088"]`.
 */
export function NectoLogo({ variant = "full", width, height }: NectoLogoProps) {
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
