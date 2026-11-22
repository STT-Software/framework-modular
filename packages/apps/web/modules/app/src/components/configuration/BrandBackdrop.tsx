import type { CSSProperties, ReactNode } from "react";

type ShapeKind = "ring" | "capsule" | "square" | "quarter" | "arc" | "wave" | "dots" | "plus" | "disc";
type ShapeTone = "indigo" | "orange" | "cyan";

interface BrandPiece {
  kind: ShapeKind;
  size: number;
  tone: ShapeTone;
  x: number;
  y: number;
  angle: number;
  wideOnly?: boolean;
}

const BRAND_PIECES: BrandPiece[] = [
  { kind: "ring", size: 11, tone: "indigo", x: 93, y: 16, angle: 10 },
  { kind: "capsule", size: 13, tone: "cyan", x: 90, y: 76, angle: -20 },
  { kind: "wave", size: 10, tone: "indigo", x: 6, y: 84, angle: -6 },
  { kind: "arc", size: 9, tone: "orange", x: 7, y: 19, angle: 40 },
  { kind: "plus", size: 5, tone: "orange", x: 95, y: 46, angle: 14, wideOnly: true },
  { kind: "dots", size: 7, tone: "indigo", x: 5, y: 52, angle: -18, wideOnly: true },
  { kind: "disc", size: 3.2, tone: "cyan", x: 25, y: 8, angle: 0 },
  { kind: "disc", size: 2.4, tone: "orange", x: 78, y: 7, angle: 0 },
];

function renderShape(kind: ShapeKind): ReactNode {
  switch (kind) {
    case "wave":
      return (
        <svg viewBox="0 0 120 30" fill="none">
          <path d="M6 15 C14 3 24 3 32 15 S50 27 58 15 S76 3 84 15 S102 27 114 15" />
        </svg>
      );
    case "dots":
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

/**
 * Decoración sutil de geometría de marca para las pantallas de configuración
 * (Setup base, Turnos y Pedidos), inspirada en la composición de bienvenida /ready.
 */
export function BrandBackdrop() {
  return (
    <div className="config-brand-backdrop" aria-hidden="true">
      {BRAND_PIECES.map((piece, i) => (
        <div
          key={i}
          className={`config-brand-piece${piece.wideOnly ? " is-wide-only" : ""}`}
          style={
            {
              "--x": `${piece.x}%`,
              "--y": `${piece.y}%`,
              "--angle": `${piece.angle}deg`,
            } as CSSProperties
          }
        >
          <div className={`ob-shape is-${piece.kind} tone-${piece.tone}`} style={{ "--size": piece.size } as CSSProperties}>
            {renderShape(piece.kind)}
          </div>
        </div>
      ))}
    </div>
  );
}
