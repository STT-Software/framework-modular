import { observer } from "mobx-react-lite";
import { useState } from "react";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { turnosStore } from "../stores/turnos.store";
import type { TurnosOperator } from "../types";
import { initialsOf } from "../validation";
import { AccessDialog } from "./AccessDialog";
import { DeleteDialog, type DeleteTarget } from "./DeleteDialog";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { OperatorDialog } from "./OperatorDialog";
import { QueuePill } from "./QueueSymbol";

/** Paso 4: el equipo. Agregar operadores es opcional; cada uno necesita al menos una fila de este negocio. */
export const OperatorsPanel = observer(() => {
  const store = turnosStore;
  const state = store.state;
  const [editing, setEditing] = useState<{ operator: TurnosOperator | null } | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [access, setAccess] = useState<string | null>(null);
  if (!state) return null;
  const hasQueues = state.queues.length > 0;
  const count = state.operators.length;
  const accessOf = access ? (state.operators.find((operator) => operator.id === access) ?? null) : null;
  const add = () => setEditing({ operator: null });

  return (
    <section className="nt-panel-enter" aria-label="Operadores de Turnos">
      <div className="nt-section-toolbar">
        <div>
          <span className="nt-badge">Solo Turnos</span>
          <span className="nt-muted">{count === 1 ? "1 operador" : `${count} operadores`}</span>
        </div>
        <button type="button" className="nt-primary" disabled={!hasQueues} onClick={add}>
          <span aria-hidden="true">+</span>Nuevo operador
        </button>
      </div>
      {count === 0 && (
        <div className="nt-card nt-empty nt-operators-empty">
          <BrandCardDecor />
          <div className="nt-team-scene" aria-hidden="true">
            <span>LM</span>
            <span>+</span>
            <span>MR</span>
            <i />
          </div>
          <h2>La atención empieza con tu equipo</h2>
          <p>Agrega personas y asigna las filas que pueden atender. Puedes continuar sin operadores y sumarlos después.</p>
          <button type="button" className="nt-secondary" disabled={!hasQueues} onClick={add}>
            Agregar primer operador
          </button>
        </div>
      )}
      <div className="nt-operator-list">
        {state.operators.map((operator) => (
          <article key={operator.id} className="nt-operator-card">
            <span className="nt-person-avatar">{initialsOf(operator.name)}</span>
            <div>
              <div className="nt-operator-name">
                <strong>{operator.name}</strong>
                <span className="nt-badge nt-neutral">Operador · Turnos</span>
              </div>
              <p className="nt-operator-email">{operator.email}</p>
              <div className="nt-queue-pills">
                {operator.queueIds.map((id) => {
                  const queue = state.queues.find((item) => item.id === id);
                  return queue ? <QueuePill key={id} name={queue.name} color={queue.color} /> : null;
                })}
              </div>
              <button type="button" className="nt-operator-access-button" aria-label={`Ver acceso de ${operator.name}`} onClick={() => setAccess(operator.id)}>
                <Icon paths={ICONS.lock} />
                Ver acceso
              </button>
            </div>
            <div className="nt-card-actions">
              <button type="button" className="nt-icon-button" aria-label={`Editar operador ${operator.name}`} onClick={() => setEditing({ operator })}>
                <Icon paths={ICONS.edit} />
              </button>
              <button type="button" className="nt-icon-button" aria-label={`Eliminar operador ${operator.name}`} onClick={() => setDeleting({ kind: "operator", id: operator.id })}>
                <Icon paths={ICONS.trash} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="nt-info-box">
        <Icon paths={ICONS.lock} />
        <p>
          <strong>El mismo acceso. Un rol diferente.</strong>
          <span>El operador usa su correo y un código OTP en el mismo login del administrador. Su acceso corresponde a Turnos y a sus filas asignadas.</span>
        </p>
      </div>
      <p className="nt-error" role="status" hidden={hasQueues}>
        Crea al menos una fila antes de agregar operadores.
      </p>
      <OperatorDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={(operatorId) => {
          setEditing(null);
          if (operatorId) setAccess(operatorId);
        }}
      />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} />
      <AccessDialog operator={accessOf} onClose={() => setAccess(null)} />
    </section>
  );
});
