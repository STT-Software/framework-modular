import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { turnosStore } from "../stores/turnos.store";
import type { OperatorForm, TurnosOperator } from "../types";
import { colorStyle } from "./QueueSymbol";
import { Modal } from "./Modal";

interface Props {
  /** `null` cierra el diálogo; `{ operator: null }` es uno nuevo; con `operator`, su edición. */
  target: { operator: TurnosOperator | null } | null;
  onClose: () => void;
  /** Se llama al guardar. Con un operador nuevo recibe su id (para mostrar su acceso). */
  onSaved: (createdOperatorId: string | null) => void;
}

function Form({ operator, onClose, onSaved }: { operator: TurnosOperator | null; onClose: () => void; onSaved: Props["onSaved"] }) {
  const store = turnosStore;
  const state = store.state!;
  const limits = state.catalog.limits;
  const nameRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<OperatorForm>({
    name: operator?.name ?? "",
    email: operator?.email ?? "",
    phone: operator?.phone ?? "",
    queueIds: operator?.queueIds ?? [],
  });
  useEffect(() => nameRef.current?.focus(), []);
  const set = <K extends keyof OperatorForm>(key: K, value: OperatorForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
  };
  const toggle = (id: string, checked: boolean) => set("queueIds", checked ? [...form.queueIds, id] : form.queueIds.filter((item) => item !== id));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await store.saveOperator(operator?.id ?? null, form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    store.announce(operator ? "Operador actualizado." : "Operador agregado a Turnos.");
    onSaved(operator ? null : (result.created ?? null));
  };

  return (
    <form onSubmit={submit} noValidate>
      <header className="nt-dialog-header">
        <div>
          <span className="nt-eyebrow">EQUIPO DE TURNOS</span>
          <h2 id="nt-operator-dialog-title">{operator ? "Editar operador" : "Nuevo operador"}</h2>
          <p>Asigna sus filas y prepara su acceso por correo.</p>
        </div>
        <button type="button" className="nt-icon-button" aria-label="Cerrar formulario de operador" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="nt-dialog-body">
        <div className="nt-field">
          <label htmlFor="nt-operator-name">
            Nombre <b>*</b>
          </label>
          <input ref={nameRef} id="nt-operator-name" maxLength={limits.operatorName.max} placeholder="Ej. Laura Gómez" autoComplete="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="nt-field">
          <label htmlFor="nt-operator-email">
            Correo para el acceso OTP <b>*</b>
          </label>
          <input id="nt-operator-email" type="email" maxLength={limits.operatorEmail.max} placeholder="laura@tunegocio.com" autoComplete="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          <small>Entrará desde el mismo login del administrador, con su rol de operador.</small>
        </div>
        <div className="nt-field">
          <label htmlFor="nt-operator-phone">
            Teléfono <small>Opcional</small>
          </label>
          <input id="nt-operator-phone" type="tel" maxLength={25} placeholder="+57 300 123 4567" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <fieldset className="nt-operator-queues-fieldset">
          <legend>
            Filas que puede atender <b>*</b>
          </legend>
          <p>Selecciona una o varias. Cada operador necesita al menos una.</p>
          <div className="nt-queue-checkboxes">
            {state.queues.map((queue) => (
              <label key={queue.id} style={colorStyle(queue.color)}>
                <input type="checkbox" name="nt-operator-queue" value={queue.id} aria-label={queue.name} checked={form.queueIds.includes(queue.id)} onChange={(e) => toggle(queue.id, e.target.checked)} />
                <i />
                <span>{queue.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="nt-error" role="status" hidden={!error}>
          {error}
        </p>
      </div>
      <footer className="nt-dialog-footer">
        <button type="button" className="nt-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="nt-primary" disabled={store.saving}>
          {operator ? "Guardar cambios" : "Agregar y preparar acceso"}
        </button>
      </footer>
    </form>
  );
}

/** El formulario de un operador: nombre y correo obligatorios, teléfono opcional y una o varias filas de este negocio. */
export const OperatorDialog = observer(({ target, onClose, onSaved }: Props) => (
  <Modal open={target !== null} onClose={onClose} labelledBy="nt-operator-dialog-title">
    {target && <Form operator={target.operator} onClose={onClose} onSaved={onSaved} />}
  </Modal>
));
