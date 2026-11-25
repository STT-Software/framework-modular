import { observer } from "mobx-react-lite";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { adminAccessStore } from "../stores/adminAccess.store";
import { SlideArt } from "./BrandScenes";

/** La sección de Turnos a la que lleva cada vista de operador (los ids son los del contrato del servidor). */
const TURNOS_SECTION_OF_VIEW: Record<string, string> = {
  home: "dashboard",
  "my-turns": "tickets",
  "create-turn": "create",
  queues: "queues",
  surveys: "surveys",
};
/**
 * Step 5: automated loading/transition screen.
 * Replaces the redundant static confirmation step with a cinematic 8-second animated transition:
 * the white canvas displaces the orange side panel, the vector illustration glides to the center,
 * and a flat, pure-orange progress bar fills below it without glow or shine effects.
 */
export const ReadyStep = observer(() => {
  const store = adminAccessStore;
  const access = store.access;
  const business = store.business;
  const headingRef = useFocusHeading();
  const baseId = useId();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const isOperator = access?.role === "operator";
  const operatorModule = isOperator ? access?.modules[0] : undefined;
  const isPedidosOperator = isOperator && operatorModule === "pedidos";
  const name = isOperator
    ? access?.businessName
    : business?.name ?? access?.businessName ?? "tu negocio";
  // El administrador entra a su dashboard (que lo manda a la configuración si falta algo); el operador, directo a la primera vista
  // de su módulo que tiene permitida, sin pasar por el dashboard general.
  const target = isOperator
    ? isPedidosOperator
      ? `/business/app/${access?.businessId}/pedidos/dashboard`
      : `/business/app/${access?.businessId}/turnos/${TURNOS_SECTION_OF_VIEW[access?.firstView ?? ""] ?? "dashboard"}`
    : `/business/app/${access?.businessId}`;

  const stageMessages = [
    "Verificando credenciales de acceso…",
    isOperator
      ? `Cargando acceso de ${isPedidosOperator ? "Pedidos" : "Turnos"} en ${name}…`
      : `Cargando configuración de ${name}…`,
    isOperator
      ? `Sincronizando módulo de Operador (${isPedidosOperator ? "Pedidos" : "Turnos"})…`
      : "Sincronizando módulos de Administrador…",
    "¡Todo listo! Ingresando a tu espacio…",
  ];

  // Exactly 8 seconds (8000ms) with staggered natural pacing:
  // avanza (0-32%), se detiene (32-35%), avanza con fuerza (35-72%), se detiene (72-75%), avanza al final (75-100%)
  useEffect(() => {
    if (!access) return;

    const DURATION = 8000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let pct = 0;
      let stage = 0;

      if (elapsed < 1600) {
        // Surge 1: arranque inicial decidido hasta ~32%
        pct = (elapsed / 1600) * 32;
        stage = 0;
      } else if (elapsed < 3200) {
        // Pausa 1: se detiene / verificación de credenciales (~32% a 35%)
        pct = 32 + ((elapsed - 1600) / 1600) * 3;
        stage = 0;
      } else if (elapsed < 5200) {
        // Surge 2: avance con fuerza cargando el entorno (~35% a 72%)
        pct = 35 + ((elapsed - 3200) / 2000) * 37;
        stage = 1;
      } else if (elapsed < 6600) {
        // Pausa 2: se detiene sincronizando módulos (~72% a 75%)
        pct = 72 + ((elapsed - 5200) / 1400) * 3;
        stage = 2;
      } else if (elapsed < 8000) {
        // Surge 3: avance fluido y continuo hasta 100%
        pct = 75 + ((elapsed - 6600) / 1400) * 25;
        stage = 3;
      } else {
        pct = 100;
        stage = 3;
      }

      setProgress(Math.min(pct, 100));
      setStageIndex(stage);

      if (elapsed >= DURATION) {
        clearInterval(interval);
        navigate(target, { replace: true });
      }
    }, 40);

    return () => clearInterval(interval);
  }, [access, navigate, target]);

  if (!access) return null;

  return (
    <section className="na-dispatch-view" aria-labelledby={`${baseId}-title`}>
      {/* Centered vector from the brand panel, styled cleanly for the white canvas */}
      <div className="na-dispatch-vector-wrap">
        <div className="na-dispatch-vector" aria-hidden="true">
          <SlideArt slide="negocios" />
        </div>
      </div>

      {/* Copy: "Ingresando a [Negocio]" */}
      <div className="na-dispatch-copy">
        <span className="na-eyebrow na-dispatch-eyebrow">
          <i />
          CONECTANDO CON TU ESPACIO
        </span>
        <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1} className="na-dispatch-title">
          Ingresando a <span>{name}</span>
        </h1>
        <p className="na-dispatch-stage">
          {stageMessages[stageIndex]}
        </p>
      </div>

      {/* Progress bar directly below the vector and copy: flat solid orange, no shine or glow */}
      <div className="na-dispatch-bar-wrap">
        <div
          className="na-dispatch-bar"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="na-dispatch-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="na-dispatch-meta">
          <span className="na-dispatch-role">
            {isOperator
              ? isPedidosOperator
                ? "Perfil: Operador de Pedidos"
                : "Perfil: Operador de Turnos"
              : "Perfil: Administrador"}
          </span>
          <span className="na-dispatch-pct">{Math.round(progress)}%</span>
        </div>
      </div>
    </section>
  );
});
