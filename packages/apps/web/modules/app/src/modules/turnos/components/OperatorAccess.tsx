import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { NectoLogo } from "@/brand/NectoLogo";
import { operatorStore } from "../stores/operator.store";
import { initialsOf } from "../validation";
import { QueueSymbol } from "./QueueSymbol";

/**
 * La pantalla del operador: quién es en este negocio y las filas que tiene asignadas. Nada administrativo: sin reglas, sin otros operadores,
 * sin acceso a otros módulos. La atención de turnos (emitir, llamar) es una etapa posterior.
 */
export const OperatorAccess = observer(({ onSignOut, signingOut }: { onSignOut: () => void; signingOut: boolean }) => {
  const store = operatorStore;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [store.status]);
  const view = store.view;
  const ready = store.status === "ready" && view !== null;
  const loading = store.status === "idle" || store.status === "loading";

  return (
    <main className="nt-access">
      <div className="nt-access-symbol" aria-hidden="true">
        <NectoLogo variant="mark" width={64} height={64} />
      </div>
      <span className="nt-eyebrow">ACCESO DE OPERADOR · TURNOS</span>
      <h1 ref={headingRef} tabIndex={-1}>
        {ready ? `Hola, ${view.operator.name.split(" ")[0]}.` : loading ? "Un momento…" : "Necesitas una asignación vigente."}
      </h1>
      <p>
        {ready
          ? `Tu acceso a ${view.business.name} está verificado.`
          : loading
            ? ""
            : store.status === "error"
              ? (store.error ?? "No pudimos abrir tu acceso.")
              : "Pide al administrador que revise tu acceso y tus filas de Turnos."}
      </p>
      {ready && (
        <>
          <div className="nt-card nt-access-card">
            <BrandCardDecor />
            <div className="nt-access-person">
              <span className="nt-person-avatar">{initialsOf(view.operator.name)}</span>
              <div>
                <h2>{view.operator.name}</h2>
                <p>{view.operator.email}</p>
              </div>
              <span className="nt-badge">Operador</span>
            </div>
            <h3>Tus filas asignadas</h3>
            <div>
              {view.queues.map((queue) => (
                <div key={queue.id} className="nt-review-queue">
                  <QueueSymbol color={queue.color} />
                  <div>
                    <strong>{queue.name}</strong>
                    <small>
                      {queue.mode === "auto" ? "Atención automática" : "Atención manual"} · {queue.averageMinutes} min por atención
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <p className="nt-help-note">Este es el resumen de tu acceso. La atención de turnos se añadirá en la siguiente etapa.</p>
          </div>
          <div className="nt-info-box">
            <p>
              <strong>Acceso limitado a este módulo.</strong>
              <span>Las filas asignadas no conceden permisos de administrador ni acceso a otros módulos.</span>
            </p>
          </div>
        </>
      )}
      <button className="nt-secondary" type="button" disabled={signingOut} onClick={onSignOut}>
        Cerrar sesión
      </button>
    </main>
  );
});
