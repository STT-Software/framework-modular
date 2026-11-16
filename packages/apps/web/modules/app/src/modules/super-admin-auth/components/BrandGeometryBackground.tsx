import { type CSSProperties, type ReactNode } from "react";

type Kind =
  | "ring"
  | "capsule"
  | "square"
  | "quarter"
  | "arc"
  | "wave"
  | "dots"
  | "plus"
  | "slashes"
  | "disc";

type Tone = "white" | "cyan" | "accent";

interface ShapeConfig {
  kind: Kind;
  size: number;
  tone: Tone;
  left: string;
  top: string;
  rotate?: number;
  floatClass: string;
}

const SHAPES: ShapeConfig[] = [
  // Arriba izquierda
  { kind: "ring", size: 68, tone: "white", left: "9%", top: "12%", floatClass: "sa-float-1" },
  { kind: "disc", size: 24, tone: "cyan", left: "26%", top: "18%", floatClass: "sa-float-3" },
  // Arriba centro y derecha
  { kind: "plus", size: 36, tone: "accent", left: "46%", top: "11%", rotate: 12, floatClass: "sa-float-2" },
  { kind: "capsule", size: 82, tone: "cyan", left: "76%", top: "13%", rotate: -25, floatClass: "sa-float-4" },
  { kind: "disc", size: 18, tone: "white", left: "89%", top: "25%", floatClass: "sa-float-1" },
  // Costados medios (flanqueando el mensaje central)
  { kind: "wave", size: 76, tone: "white", left: "6%", top: "42%", rotate: -8, floatClass: "sa-float-2" },
  { kind: "square", size: 54, tone: "accent", left: "84%", top: "44%", rotate: 16, floatClass: "sa-float-3" },
  // Abajo izquierda
  { kind: "quarter", size: 58, tone: "cyan", left: "11%", top: "68%", rotate: 45, floatClass: "sa-float-4" },
  { kind: "slashes", size: 48, tone: "accent", left: "25%", top: "82%", floatClass: "sa-float-1" },
  // Abajo centro y derecha
  { kind: "arc", size: 64, tone: "white", left: "48%", top: "84%", rotate: -35, floatClass: "sa-float-2" },
  { kind: "dots", size: 52, tone: "white", left: "74%", top: "70%", floatClass: "sa-float-3" },
  { kind: "ring", size: 50, tone: "cyan", left: "86%", top: "83%", floatClass: "sa-float-4" },
];

function renderShapeInner(kind: Kind): ReactNode {
  switch (kind) {
    case "wave":
      return (
        <svg viewBox="0 0 120 30" fill="none">
          <path d="M6 15 C14 3 24 3 32 15 S50 27 58 15 S76 3 84 15 S102 27 114 15" />
        </svg>
      );
    case "dots":
    case "slashes":
    case "plus":
      return (
        <>
          <b />
          <b />
          <b />
        </>
      );
    default:
      return null;
  }
}

/**
 * Fondo decorativo estático en posición con suave flotación ambiental.
 * Al pasar el mouse, cada objeto se ilumina en blanco puro con resplandor.
 */
export function BrandGeometryBackground() {
  return (
    <div className="sa-geo-canvas" aria-hidden="true">
      {SHAPES.map((shape, i) => (
        <div
          key={i}
          className={`sa-geo-piece tone-${shape.tone}`}
          style={
            {
              left: shape.left,
              top: shape.top,
              "--geo-size": `${shape.size}px`,
              transform: shape.rotate ? `rotate(${shape.rotate}deg)` : undefined,
            } as CSSProperties
          }
        >
          <div className={`sa-geo-float ${shape.floatClass}`}>
            <div className={`sa-shape is-${shape.kind}`}>
              {renderShapeInner(shape.kind)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
