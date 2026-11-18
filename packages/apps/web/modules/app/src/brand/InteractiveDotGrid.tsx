import { useEffect, useRef } from "react";

export interface InteractiveDotGridProps {
  dotGap?: number;
  baseRadius?: number;
  activeRadius?: number;
  glowDistance?: number;
  /** RGB triplet (e.g. "255, 255, 255") used for idle and hovered dots. */
  dotRgb?: string;
  baseAlpha?: number;
  activeAlpha?: number;
  activeDotColor?: string;
  glowColor?: string;
  className?: string;
}

interface MouseState {
  x: number;
  y: number;
  intensity: number;
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillStyle: string,
  shadowBlur: number,
  shadowColor: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.shadowBlur = shadowBlur;
  ctx.shadowColor = shadowColor;
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawDotMatrix(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  offsetX: number,
  offsetY: number,
  dotGap: number,
  baseRadius: number,
  activeRadius: number,
  glowDistance: number,
  dotRgb: string,
  baseAlpha: number,
  activeAlpha: number,
  activeColor: string,
  shadowColor: string,
  mouse: MouseState | null,
) {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = offsetX + i * dotGap;
      const y = offsetY + j * dotGap;

      let radius = baseRadius;
      let alpha = baseAlpha;
      let isHover = false;

      if (mouse && mouse.intensity > 0.01) {
        const dist = Math.hypot(x - mouse.x, y - mouse.y);
        if (dist < glowDistance) {
          const norm = 1 - dist / glowDistance;
          const factor = Math.pow(norm, 2.2) * mouse.intensity;
          radius = baseRadius + (activeRadius - baseRadius) * factor;
          alpha = baseAlpha + (activeAlpha - baseAlpha) * factor;
          isHover = factor > 0.3;
        }
      }

      if (isHover) {
        drawDot(ctx, x, y, radius, activeColor, activeRadius * 1.5, shadowColor);
      } else {
        drawDot(ctx, x, y, radius, `rgba(${dotRgb}, ${alpha.toFixed(3)})`, 0, "transparent");
      }
    }
  }
}

/**
 * Interactive canvas dot-matrix background that illuminates smoothly under cursor proximity,
 * without background loop animations; degrades to a crisp static dot matrix under reduced motion.
 */
export default function InteractiveDotGrid({
  dotGap = 26,
  baseRadius = 1.9,
  activeRadius = 4.2,
  glowDistance = 170,
  dotRgb = "255, 255, 255",
  baseAlpha = 0.18,
  activeAlpha = 0.95,
  activeDotColor,
  glowColor,
  className = "",
}: InteractiveDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resolvedActiveColor = activeDotColor ?? `rgba(${dotRgb}, ${Math.min(1, activeAlpha + 0.03).toFixed(2)})`;
    const resolvedGlowColor = glowColor ?? `rgba(${dotRgb}, 0.75)`;
    const motionQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    let animId = 0;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let offsetX = 0;
    let offsetY = 0;
    let reducedMotion = motionQuery?.matches ?? false;

    const targetMouse = { x: -9999, y: -9999, active: false };
    const currentMouse: MouseState = { x: -9999, y: -9999, intensity: 0 };

    const drawMatrixFrame = (mouse: MouseState | null) => {
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      drawDotMatrix(
        ctx,
        cols,
        rows,
        offsetX,
        offsetY,
        dotGap,
        baseRadius,
        activeRadius,
        glowDistance,
        dotRgb,
        baseAlpha,
        activeAlpha,
        resolvedActiveColor,
        resolvedGlowColor,
        mouse,
      );
    };

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / dotGap) + 1;
      rows = Math.ceil(height / dotGap) + 1;
      offsetX = (width - (cols - 1) * dotGap) / 2;
      offsetY = (height - (rows - 1) * dotGap) / 2;

      drawMatrixFrame(!reducedMotion && currentMouse.intensity > 0.01 ? currentMouse : null);
    };

    const loop = () => {
      if (reducedMotion) {
        animId = 0;
        return;
      }

      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.16;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.16;
      const targetIntensity = targetMouse.active ? 1 : 0;
      currentMouse.intensity += (targetIntensity - currentMouse.intensity) * 0.12;

      if (!targetMouse.active && currentMouse.intensity <= 0.005) {
        currentMouse.intensity = 0;
        drawMatrixFrame(null);
        animId = 0;
        return;
      }

      drawMatrixFrame(currentMouse);
      animId = requestAnimationFrame(loop);
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion && animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
      if (reducedMotion) {
        currentMouse.intensity = 0;
        drawMatrixFrame(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      const rect = canvas.getBoundingClientRect();
      targetMouse.x = e.clientX - rect.left;
      targetMouse.y = e.clientY - rect.top;
      targetMouse.active = true;
      if (!animId) {
        animId = requestAnimationFrame(loop);
      }
    };

    const handleMouseLeave = () => {
      targetMouse.active = false;
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener("mousemove", handleMouseMove, { passive: true });
      parent.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    }
    motionQuery?.addEventListener("change", handleMotionChange);

    const resizeObserver = new ResizeObserver(handleResize);
    if (parent) {
      resizeObserver.observe(parent);
    }
    handleResize();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      motionQuery?.removeEventListener("change", handleMotionChange);
      if (parent) {
        parent.removeEventListener("mousemove", handleMouseMove);
        parent.removeEventListener("mouseleave", handleMouseLeave);
        resizeObserver.unobserve(parent);
      }
      resizeObserver.disconnect();
    };
  }, [dotGap, baseRadius, activeRadius, glowDistance, dotRgb, baseAlpha, activeAlpha, activeDotColor, glowColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
}
