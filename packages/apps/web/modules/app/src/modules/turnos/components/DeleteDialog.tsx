import { observer } from "mobx-react-lite";
import { useState } from "react";
import { turnosStore } from "../stores/turnos.store";
import { Modal } from "./Modal";

export type DeleteTarget = { kind: "queue" | "operator"; id: string };

interface Props {
  target: DeleteTarget | null;
  onClose: () => void;
}

function Body({ target, onClose }: { target: DeleteTarget; onClose: () => void }) {
  const store = turnosStore;
  const state = store.state!;
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const isQueue = target.kind === "queue";
  const queue = isQueue ? state.queues.find((item) => item.id === target.id) : undefined;
  const operator = !isQueue ? state.operators.find((item) => item.id === target.id) : undefined;
  // Quien se quedaría sin ninguna fila necesita otra: se elige aquí y el servidor lo cambia todo en una sola operación.
  const stranded = isQueue ? state.operators.filter((item) => item.queueIds.length === 1 && item.queueIds[0] === target.id) : [];
  const alternatives = isQueue ? state.queues.filter((item) => item.id !== target.id) : [];
  const blocked = stranded.length > 0 && alternatives.length === 0;

  if (!queue && !operator) return null;

  const confirm = async () => {
    if (isQueue) {
      const missing = stranded.some((item) => !choices[item.id]);
      if (missing) {
        setError("Selecciona una fila nueva para cada operador.");
        return;
      }
      const result = await store.deleteQueue(target.id, stranded.map((item) => ({ operatorId: item.id, queueId: choices[item.id] })));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      store.announce("Fila eliminada. Todos los operadores conservan al menos una fila.");
    } else {
      const result = await store.deleteOperator(target.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      store.announce("Operador eliminado de Turnos.");
    }
    onClose();
  };

  return (
    <>
      <header className="nt-dialog-header">
        <div>
          <span className="nt-eyebrow">REVISAR CAMBIO</span>
          <h2 id="nt-delete-title">{isQueue ? "Eliminar fila" : "Eliminar operador"}</h2>
        </div>
        <button type="button" className="nt-icon-button" aria-label="Cerrar confirmación" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="nt-dialog-body">
        <p>
          {isQueue
            ? `¿Quieres eliminar «${queue!.name}»? ${stranded.length > 0 ? "Antes, reasigna a las personas que quedarían sin ninguna fila." : "Se quitará esta fila de las asignaciones de sus operadores."}`
            : `¿Quieres quitar a ${operator!.name} de Turnos? Sus filas y los demás operadores se conservarán. Su correo y sus otros accesos no se tocan.`}
        </p>
        <div>
          {!blocked &&
            stranded.map((person) => (
              <div key={person.id} className="nt-reassign-row">
                <div className="nt-field">
                  <label htmlFor={`nt-reassign-${person.id}`}>{person.name} · nueva fila</label>
                  <select
                    id={`nt-reassign-${person.id}`}
                    value={choices[person.id] ?? ""}
                    onChange={(event) => {
                      setChoices((previous) => ({ ...previous, [person.id]: event.target.value }));
                      setError("");
                    }}
                  >
                    <option value="">Selecciona una fila</option>
                    {alternatives.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
        </div>
        <p className="nt-error" role="status" hidden={!error && !blocked}>
          {blocked ? `Es la única fila de ${stranded.map((person) => person.name).join(", ")}. Crea otra fila y reasigna al equipo, o retira a esos operadores antes de eliminarla.` : error}
        </p>
      </div>
      <footer className="nt-dialog-footer">
        <button className="nt-secondary" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="nt-danger" type="button" disabled={blocked || store.saving} onClick={() => void confirm()}>
          {isQueue ? "Eliminar fila" : "Eliminar operador"}
        </button>
      </footer>
    </>
  );
}

/** Eliminar una fila o un operador. Con una fila, quien se quedaría sin ninguna elige a cuál pasa antes de confirmar. */
export const DeleteDialog = observer(({ target, onClose }: Props) => (
  <Modal open={target !== null} onClose={onClose} labelledBy="nt-delete-title">
    {target && <Body target={target} onClose={onClose} />}
  </Modal>
));
