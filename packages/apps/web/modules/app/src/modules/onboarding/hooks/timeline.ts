/** Salida tipo *expo*: la curva por defecto de la bienvenida. */
export const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface Timeline {
  animations: Animation[];
  at: (
    target: Element | null | undefined,
    frames: Keyframe[],
    start: number,
    duration: number,
    options?: KeyframeAnimationOptions,
  ) => Animation | undefined;
}

/**
 * Una sola línea de tiempo con la Web Animations API: cada paso se programa con su retraso absoluto.
 * El primer paso que toca una propiedad de un elemento rellena hacia atrás (define el estado inicial);
 * los siguientes solo hacia adelante, para no pisar al anterior mientras esperan.
 */
export function createTimeline(): Timeline {
  const animations: Animation[] = [];
  const touched = new WeakMap<Element, Set<string>>();
  return {
    animations,
    at(target, frames, start, duration, options = {}) {
      if (!target) return undefined;
      const props = new Set(frames.flatMap((frame) => Object.keys(frame).filter((k) => k !== "offset" && k !== "easing")));
      const seen = touched.get(target) ?? new Set<string>();
      const fresh = [...props].every((p) => !seen.has(p));
      props.forEach((p) => seen.add(p));
      touched.set(target, seen);
      const animation = target.animate(frames, { delay: start, duration, easing: EASE_OUT, fill: fresh ? "both" : "forwards", ...options });
      animations.push(animation);
      return animation;
    },
  };
}
