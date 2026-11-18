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

const TWO_PI = Math.PI * 2;
const ALPHA_STEPS = 16;
const EASE_POSITION = 0.16;
const EASE_INTENSITY = 0.12;

/**
 * Interactive canvas dot-matrix background that illuminates smoothly under cursor proximity.
 * The animation loop only runs while the cursor glow is converging, pauses when the tab is hidden,
 * and degrades to a crisp static dot matrix under reduced motion.
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
    const parent = canvas.parentElement;

    const resolvedActiveColor = activeDotColor ?? `rgba(${dotRgb}, ${Math.min(1, activeAlpha + 0.03).toFixed(2)})`;
    const resolvedGlowColor = glowColor ?? `rgba(${dotRgb}, 0.75)`;
    const baseFill = `rgba(${dotRgb}, ${baseAlpha.toFixed(3)})`;
    const hoverShadowBlur = activeRadius * 1.5;
    // Precomputed fill styles for quantized alpha between baseAlpha and activeAlpha.
    const alphaTable: string[] = [];
    for (let k = 0; k <= ALPHA_STEPS; k++) {
      const a = baseAlpha + ((activeAlpha - baseAlpha) * k) / ALPHA_STEPS;
      alphaTable.push(`rgba(${dotRgb}, ${a.toFixed(3)})`);
    }

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
    let rectLeft = 0;
    let rectTop = 0;
    let reducedMotion = motionQuery?.matches ?? false;

    const targetMouse = { x: -9999, y: -9999, active: false };
    const currentMouse: MouseState = { x: -9999, y: -9999, intensity: 0 };

    const drawFrame = (mouse: MouseState | null) => {
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      const lit = mouse !== null && mouse.intensity > 0.01;
      const glowSq = glowDistance * glowDistance;

      // Pass 1: every idle dot in a single path.
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.fillStyle = baseFill;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const x = offsetX + i * dotGap;
        for (let j = 0; j < rows; j++) {
          const y = offsetY + j * dotGap;
          if (lit) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            if (dx * dx + dy * dy < glowSq) continue;
          }
          ctx.moveTo(x + baseRadius, y);
          ctx.arc(x, y, baseRadius, 0, TWO_PI);
        }
      }
      ctx.fill();

      if (!lit) return;

      // Pass 2: only dots inside the glow radius, drawn individually.
      const minI = Math.max(0, Math.floor((mouse.x - glowDistance - offsetX) / dotGap));
      const maxI = Math.min(cols - 1, Math.ceil((mouse.x + glowDistance - offsetX) / dotGap));
      const minJ = Math.max(0, Math.floor((mouse.y - glowDistance - offsetY) / dotGap));
      const maxJ = Math.min(rows - 1, Math.ceil((mouse.y + glowDistance - offsetY) / dotGap));
      for (let i = minI; i <= maxI; i++) {
        const x = offsetX + i * dotGap;
        for (let j = minJ; j <= maxJ; j++) {
          const y = offsetY + j * dotGap;
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= glowSq) continue;
          const norm = 1 - Math.sqrt(distSq) / glowDistance;
          const factor = Math.pow(norm, 2.2) * mouse.intensity;
          const radius = baseRadius + (activeRadius - baseRadius) * factor;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, TWO_PI);
          if (factor > 0.3) {
            ctx.shadowBlur = hoverShadowBlur;
            ctx.shadowColor = resolvedGlowColor;
            ctx.fillStyle = resolvedActiveColor;
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.fillStyle = alphaTable[Math.round(factor * ALPHA_STEPS)];
          }
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    };

    const updateRect = () => {
      const rect = canvas.getBoundingClientRect();
      rectLeft = rect.left;
      rectTop = rect.top;
    };

    const stop = () => {
      if (animId) cancelAnimationFrame(animId);
      animId = 0;
    };

    const loop = () => {
      animId = 0;
      if (reducedMotion || document.hidden) return;

      const dx = targetMouse.x - currentMouse.x;
      const dy = targetMouse.y - currentMouse.y;
      const targetIntensity = targetMouse.active ? 1 : 0;
      const di = targetIntensity - currentMouse.intensity;
      currentMouse.x += dx * EASE_POSITION;
      currentMouse.y += dy * EASE_POSITION;
      currentMouse.intensity += di * EASE_INTENSITY;

      const settledIntensity = targetMouse.active
        ? Math.abs(di) < 0.005
        : currentMouse.intensity <= 0.005;
      const converged = settledIntensity
        && (!targetMouse.active || (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1));

      if (converged) {
        currentMouse.intensity = targetIntensity;
        if (targetMouse.active) {
          currentMouse.x = targetMouse.x;
          currentMouse.y = targetMouse.y;
        }
        drawFrame(currentMouse.intensity > 0.01 ? currentMouse : null);
        return;
      }

      drawFrame(currentMouse);
      animId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!animId && !reducedMotion && !document.hidden) {
        animId = requestAnimationFrame(loop);
      }
    };

    const handleResize = () => {
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
      updateRect();

      drawFrame(!reducedMotion && currentMouse.intensity > 0.01 ? currentMouse : null);
      start();
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stop();
        currentMouse.intensity = 0;
        targetMouse.active = false;
        drawFrame(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      targetMouse.x = e.clientX - rectLeft;
      targetMouse.y = e.clientY - rectTop;
      targetMouse.active = true;
      start();
    };

    const handleMouseLeave = () => {
      targetMouse.active = false;
      start();
    };

    if (parent) {
      parent.addEventListener("mousemove", handleMouseMove, { passive: true });
      parent.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    }
    window.addEventListener("scroll", updateRect, { passive: true, capture: true });
    window.addEventListener("resize", updateRect, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionQuery?.addEventListener("change", handleMotionChange);

    const resizeObserver = new ResizeObserver(handleResize);
    if (parent) resizeObserver.observe(parent);
    handleResize();

    return () => {
      stop();
      motionQuery?.removeEventListener("change", handleMotionChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("scroll", updateRect, { capture: true });
      window.removeEventListener("resize", updateRect);
      if (parent) {
        parent.removeEventListener("mousemove", handleMouseMove);
        parent.removeEventListener("mouseleave", handleMouseLeave);
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
