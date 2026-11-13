import { useRef } from "react";
import { useSceneMotion } from "../hooks/useSceneMotion";

/** Escena 3 (Crece): tres arcos suben y un punto remata el más alto. */
export function GrowScene() {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(ref, (root, motion) => {
    root.querySelectorAll(".ob-growth-arch").forEach((path, i) =>
      motion(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: 100 + i * 110, duration: 950 }),
    );
    motion(
      root.querySelector(".ob-growth-dot"),
      [
        { opacity: 0, transform: "translateY(60px) scale(.5)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { delay: 350, duration: 900 },
    );
    motion(root.querySelector(".ob-growth-spark"), [{ opacity: 0 }, { opacity: 1 }], { delay: 900, duration: 350 });
  });

  return (
    <section ref={ref} className="ob-scene" aria-labelledby="ob-grow-heading">
      <div className="ob-graphic ob-growth" aria-hidden="true">
        <svg viewBox="0 0 480 300" fill="none">
          <path d="M74 256V218a72 72 0 0 1 144 0v38" className="ob-growth-arch arch-one" pathLength="1" />
          <path d="M180 256V163a72 72 0 0 1 144 0v93" className="ob-growth-arch arch-two" pathLength="1" />
          <path d="M286 256V108a72 72 0 0 1 144 0v148" className="ob-growth-arch arch-three" pathLength="1" />
          <path d="M52 266H441" className="ob-growth-baseline" />
          <circle cx="358" cy="65" r="19" className="ob-growth-dot" />
          <path d="M358 8v12m-45 7 8 8m82-8-8 8" className="ob-growth-spark" />
        </svg>
      </div>
      <div className="ob-scene-copy">
        <span className="ob-kicker" data-reveal>
          03 / CRECE
        </span>
        <h1 id="ob-grow-heading" data-reveal>
          Lo construimos <em>juntos.</em>
        </h1>
        <p data-reveal>Cada conexión abre una nueva posibilidad.</p>
      </div>
    </section>
  );
}
