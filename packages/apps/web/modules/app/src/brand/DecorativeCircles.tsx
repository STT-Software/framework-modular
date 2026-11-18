import React from "react";

/**
 * DecorativeCircles — brand rings for colored side panels.
 *
 * Three thick rings cut by the panel edges:
 * - two light rings (18px stroke): top-left and bottom-right;
 * - one large accent ring (22px stroke): vertically centered on the right edge.
 */

export interface DecorativeCirclesProps {
  /** Color scheme matching the panel background. */
  variant?: "brand" | "indigo" | "canvas";
  /** Extra classes on the container. */
  className?: string;
}

export function DecorativeCircles({
  variant = "brand",
  className = "",
}: DecorativeCirclesProps) {
  const isBrand = variant === "brand";
  const isCanvas = variant === "canvas";

  const claro = isCanvas ? "rgba(255,63,26,0.12)" : "rgba(255,255,255,0.55)";
  const acento = isCanvas
    ? "rgba(25,0,136,0.15)"
    : isBrand
      ? "rgba(255,255,255,0.35)"
      : "#FF3F1A";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute rounded-full opacity-[0.30]"
        style={{
          width: "440px",
          height: "440px",
          top: "-160px",
          left: "-170px",
          border: `18px solid ${claro}`,
        }}
      />

      <div
        className="absolute rounded-full opacity-[0.28]"
        style={{
          width: "320px",
          height: "320px",
          bottom: "-130px",
          right: "-90px",
          border: `18px solid ${claro}`,
        }}
      />

      <div
        className="absolute rounded-full"
        style={{
          width: "280px",
          height: "280px",
          top: "50%",
          right: "-110px",
          transform: "translateY(-50%)",
          border: `22px solid ${acento}`,
          opacity: isBrand ? 0.55 : 0.92,
        }}
      />
    </div>
  );
}

export default DecorativeCircles;
