import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "./useReducedMotion";

export type MotionFn = (
  element: Element | null | undefined,
  frames: Keyframe[],
  options?: KeyframeAnimationOptions,
) => void;

interface RevealOptions {
  /** Retraso del primer elemento `[data-reveal]`, en ms. */
  delay: number;
  /** Retraso extra por cada elemento siguiente, en ms. */
  step: number;
  /** Cuánto suben, en px, al aparecer. */
  distance: number;
}

const DEFAULT_REVEAL: RevealOptions = { delay: 250, step: 85, distance: 16 };

/**
 * Anima una escena al montarse con la Web Animations API. Los elementos con `data-reveal`
 * aparecen en cascada; lo demás lo define `build` con la función `motion`.
 * Sin animaciones si la persona pidió movimiento reducido. Al desmontar, cancela todo.
 */
export function useSceneMotion(
  ref: RefObject<HTMLElement | null>,
  build?: (root: HTMLElement, motion: MotionFn) => void,
  reveal: RevealOptions = DEFAULT_REVEAL,
): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;

    const animations: Animation[] = [];
    const motion: MotionFn = (element, frames, options = {}) => {
      if (!element) return;
      animations.push(
        element.animate(frames, { duration: 650, easing: "cubic-bezier(.16,1,.3,1)", fill: "both", ...options }),
      );
    };

    root.querySelectorAll("[data-reveal]").forEach((element, i) =>
      motion(
        element,
        [
          { opacity: 0, transform: `translateY(${reveal.distance}px)` },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { delay: reveal.delay + i * reveal.step },
      ),
    );
    build?.(root, motion);

    return () => animations.forEach((animation) => animation.cancel());
    // La escena se anima una sola vez, al montarse.
  }, []);
}
