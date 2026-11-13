import { useEffect, useRef } from "react";
import { SEQUENCE } from "../sequence";
import { prefersReducedMotion } from "../hooks/useReducedMotion";

interface SegmentProps {
  active: boolean;
  complete: boolean;
  duration: number;
}

/** Un tramo de la barra: se llena en `duration` ms mientras su escena está activa. */
function Segment({ active, complete, duration }: SegmentProps) {
  const fill = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!active || !fill.current || prefersReducedMotion()) return;
    const animation = fill.current.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration,
      easing: "linear",
      fill: "both",
    });
    return () => animation.cancel();
  }, [active, duration]);

  return (
    <span className={complete ? "is-complete" : undefined}>
      <i ref={fill} />
    </span>
  );
}

/** Barra de progreso de la historia: un tramo por escena. `index` es la escena actual (o el total al terminar). */
export function StoryProgress({ index }: { index: number }) {
  return (
    <div className="ob-story-progress" aria-hidden="true">
      {SEQUENCE.map((item, i) => (
        <Segment key={item.id} active={i === index} complete={i < index} duration={item.duration} />
      ))}
    </div>
  );
}
