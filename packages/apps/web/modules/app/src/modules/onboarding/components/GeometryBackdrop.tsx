import type { CSSProperties, ReactNode } from "react";

/*
 * Fondo de la pantalla final (`/welcome/ready`): las formas de la geometría de marca como decoración fija alrededor
 * del contenido. No se mueven ni responden al puntero: solo entran una vez, escalonadas, con una animación CSS de
 * opacidad y escala (lo compone la GPU). Sin JavaScript en marcha, sin bucles.
 */

type Kind = "ring" | "capsule" | "square" | "quarter" | "arc" | "wave" | "dots" | "plus" | "slashes" | "disc";
type Tone = "indigo" | "orange" | "cyan";

interface Piece {
  kind: Kind;
  /** Ancho en vmin. */
  size: number;
  tone: Tone;
  /** Centro como porcentaje de la pantalla; quedan en los márgenes, lejos del texto. */
  x: number;
  y: number;
  /** Giro fijo en grados. */
  angle: number;
  /** Cerca del contenido en pantallas angostas: solo se muestra en pantallas anchas. */
  wideOnly?: boolean;
}

const PIECES: Piece[] = [
  { kind: "ring", size: 12, tone: "indigo", x: 9, y: 24, angle: 0 },
  { kind: "capsule", size: 14, tone: "cyan", x: 86, y: 20, angle: -18 },
  { kind: "square", size: 8, tone: "indigo", x: 90, y: 66, angle: 14, wideOnly: true },
  { kind: "quarter", size: 8, tone: "cyan", x: 8, y: 78, angle: 0 },
  { kind: "arc", size: 9, tone: "orange", x: 18, y: 52, angle: -30, wideOnly: true },
  { kind: "wave", size: 11, tone: "indigo", x: 74, y: 88, angle: -6 },
  { kind: "dots", size: 8, tone: "indigo", x: 28, y: 90, angle: -24 },
  { kind: "plus", size: 6, tone: "orange", x: 94, y: 42, angle: 12, wideOnly: true },
  { kind: "slashes", size: 7, tone: "orange", x: 5, y: 48, angle: 0, wideOnly: true },
  { kind: "disc", size: 4, tone: "cyan", x: 24, y: 12, angle: 0 },
  { kind: "disc", size: 2.6, tone: "orange", x: 74, y: 10, angle: 0 },
];

function inner(kind: Kind): ReactNode {
  switch (kind) {
    case "wave":
      return (
        <svg viewBox="0 0 120 30" fill="none">
          <path d="M6 15 C14 3 24 3 32 15 S50 27 58 15 S76 3 84 15 S102 27 114 15" />
        </svg>
      );
    case "dots":
    case "slashes":
      return (
        <>
          <b />
          <b />
          <b />
        </>
      );
    case "plus":
      return (
        <>
          <b />
          <b />
        </>
      );
    default:
      return null;
  }
}

export function GeometryBackdrop() {
  return (
    <div className="ob-decor" aria-hidden="true">
      {PIECES.map((piece, i) => (
        <div
          key={i}
          className={`ob-decor-piece${piece.wideOnly ? " is-wide-only" : ""}`}
          style={{ "--x": `${piece.x}%`, "--y": `${piece.y}%`, "--angle": `${piece.angle}deg`, "--i": i } as CSSProperties}
        >
          <div className={`ob-shape is-${piece.kind} tone-${piece.tone}`} style={{ "--size": piece.size } as CSSProperties}>
            {inner(piece.kind)}
          </div>
        </div>
      ))}
    </div>
  );
}
