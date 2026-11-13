import { useRef } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { useSceneMotion } from "../hooks/useSceneMotion";

/** Escena 1 (Conecta): una red de nodos que se une alrededor de la marca. */
export function ConnectScene() {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(ref, (root, motion) => {
    root.querySelectorAll(".ob-connection").forEach((path, i) =>
      motion(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: 180 + i * 85, duration: 800 }),
    );
    root.querySelectorAll(".ob-node").forEach((node, i) =>
      motion(
        node,
        [
          { opacity: 0, transform: "scale(.3)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { delay: 120 + i * 100 },
      ),
    );
    motion(root.querySelector(".ob-center-mark"), [
      { opacity: 0, transform: "translate(-50%,-50%) scale(.7)" },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
    ]);
  });

  return (
    <section ref={ref} className="ob-scene" aria-labelledby="ob-connect-heading">
      <div className="ob-graphic ob-network" aria-hidden="true">
        <svg viewBox="0 0 480 300" fill="none">
          <circle cx="240" cy="150" r="118" className="ob-network-orbit" />
          <path className="ob-connection" d="M240 150Q175 160 106 76" pathLength="1" />
          <path className="ob-connection" d="M240 150Q302 129 363 67" pathLength="1" />
          <path className="ob-connection" d="M240 150Q328 146 408 214" pathLength="1" />
          <path className="ob-connection" d="M240 150Q182 194 104 238" pathLength="1" />
          <path
            className="ob-connection ob-connection-soft"
            d="M106 76Q234 7 363 67M104 238Q279 315 408 214"
            pathLength="1"
          />
          <g className="ob-node">
            <circle cx="106" cy="76" r="24" className="ob-node-shell" />
            <circle cx="106" cy="76" r="10" className="ob-node-core" />
          </g>
          <g className="ob-node">
            <circle cx="363" cy="67" r="17" className="ob-node-shell" />
            <circle cx="363" cy="67" r="6" className="ob-node-blue" />
          </g>
          <g className="ob-node">
            <circle cx="408" cy="214" r="30" className="ob-node-shell" />
            <circle cx="408" cy="214" r="14" className="ob-node-cyan" />
          </g>
          <g className="ob-node">
            <circle cx="104" cy="238" r="18" className="ob-node-shell" />
            <circle cx="104" cy="238" r="6" className="ob-node-core" />
          </g>
          <circle cx="240" cy="150" r="48" className="ob-network-center" />
        </svg>
        <div className="ob-center-mark">
          <NectoLogo variant="mark" width={64} height={64} />
        </div>
      </div>
      <div className="ob-scene-copy">
        <span className="ob-kicker" data-reveal>
          01 / CONECTA
        </span>
        <h1 id="ob-connect-heading" data-reveal>
          Encuentra tu <em>conexión.</em>
        </h1>
        <p data-reveal>Las mejores cosas empiezan con otras personas.</p>
      </div>
    </section>
  );
}
