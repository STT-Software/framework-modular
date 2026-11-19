import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { turnosStore } from "../stores/turnos.store";
import type { QueueForm, TurnosQueue } from "../types";
import { overridesOf, ticketFor } from "../validation";
import { colorStyle } from "./QueueSymbol";
import { QUEUE_COLOR_CHOICES } from "./icons";
import { Modal } from "./Modal";

interface Props {
  /** `null` cierra el diálogo; `{ queue: null }` es una fila nueva; con `queue`, su edición. */
  target: { queue: TurnosQueue | null } | null;
  onClose: () => void;
}

const own = (value: number | null) => (value === null ? "" : String(value));

function Form({ queue, onClose }: { queue: TurnosQueue | null; onClose: () => void }) {
  const store = turnosStore;
  const state = store.state!;
  const rules = state.rules;
  const nameRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<QueueForm>(() => ({
    name: queue?.name ?? "",
    mode: queue?.mode ?? "auto",
    averageMinutes: String(queue?.averageMinutes ?? 15),
    color: queue?.color ?? state.catalog.colors[state.queues.length % state.catalog.colors.length],
    prefix: queue?.overrides.prefix ?? "",
    urgentMinutes: own(queue?.overrides.urgentMinutes ?? null),
    busyLimit: own(queue?.overrides.busyLimit ?? null),
    fullLimit: own(queue?.overrides.fullLimit ?? null),
  }));
  useEffect(() => nameRef.current?.focus(), []);
  const set = <K extends keyof QueueForm>(key: K, value: QueueForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
  };
  const limits = state.catalog.limits;
  const general = (key: "urgentMinutes" | "busyLimit" | "fullLimit") => `General: ${rules[key]}`;
  const prefixHint = rules.prefixMode === "initial" ? "General: inicial de la fila" : rules.prefixMode === "fixed" ? `General: ${rules.fixedPrefix ?? ""}` : "General: sin prefijo";
  const preview = ticketFor({ name: form.name.trim() || "Tu fila", overrides: overridesOf(form) }, rules);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await store.saveQueue(queue?.id ?? null, form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    store.announce(queue ? "Fila actualizada." : "Fila creada.");
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate>
      <header className="nt-dialog-header">
        <div>
          <span className="nt-eyebrow">FILAS DE ATENCIÓN</span>
          <h2 id="nt-queue-dialog-title">{queue ? "Editar fila" : "Nueva fila"}</h2>
          <p>Un servicio, una fila y una atención más clara.</p>
        </div>
        <button type="button" className="nt-icon-button" aria-label="Cerrar formulario de fila" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="nt-dialog-body">
        <div className="nt-field">
          <label htmlFor="nt-queue-name">
            Nombre de la fila <b>*</b>
          </label>
          <input ref={nameRef} id="nt-queue-name" maxLength={limits.queueName.max} placeholder="Ej. Consulta general" required autoComplete="off" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="nt-field-grid">
          <div className="nt-field">
            <label htmlFor="nt-queue-mode">Modo de atención</label>
            <select id="nt-queue-mode" value={form.mode} onChange={(e) => set("mode", e.target.value as QueueForm["mode"])}>
              <option value="auto">Automático</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="nt-field">
            <label htmlFor="nt-queue-average">Tiempo promedio</label>
            <div className="nt-input-unit">
              <input id="nt-queue-average" type="number" min={limits.averageMinutes.min} max={limits.averageMinutes.max} inputMode="numeric" value={form.averageMinutes} onChange={(e) => set("averageMinutes", e.target.value)} />
              <span>min</span>
            </div>
          </div>
        </div>
        <fieldset className="nt-color-fieldset">
          <legend>Color de la fila</legend>
          <div className="nt-color-options">
            {QUEUE_COLOR_CHOICES.map((choice) => (
              <label key={choice.id} style={colorStyle(choice.id)}>
                <input type="radio" name="nt-queue-color" value={choice.id} aria-label={choice.name} checked={form.color === choice.id} onChange={() => set("color", choice.id)} />
                <span />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="nt-override-box">
          <div>
            <h3>Reglas de esta fila</h3>
            <span className="nt-badge nt-neutral">Opcional</span>
          </div>
          <p>Deja un campo vacío para que use su valor general. Personalizar un dato no cambia los demás.</p>
          <div className="nt-field-grid">
            <div className="nt-field">
              <label htmlFor="nt-queue-prefix">Prefijo del turno</label>
              <input id="nt-queue-prefix" maxLength={limits.prefix.max} placeholder={prefixHint} autoComplete="off" value={form.prefix} onChange={(e) => set("prefix", e.target.value)} />
            </div>
            <div className="nt-field">
              <label htmlFor="nt-queue-urgent">Urgente desde</label>
              <div className="nt-input-unit">
                <input id="nt-queue-urgent" type="number" min={limits.urgentMinutes.min} max={limits.urgentMinutes.max} placeholder={general("urgentMinutes")} inputMode="numeric" value={form.urgentMinutes} onChange={(e) => set("urgentMinutes", e.target.value)} />
                <span>min</span>
              </div>
            </div>
            <div className="nt-field">
              <label htmlFor="nt-queue-busy">Ocupada desde</label>
              <input id="nt-queue-busy" type="number" min={limits.busyLimit.min} max={limits.busyLimit.max} placeholder={general("busyLimit")} inputMode="numeric" value={form.busyLimit} onChange={(e) => set("busyLimit", e.target.value)} />
            </div>
            <div className="nt-field">
              <label htmlFor="nt-queue-full">Llena desde</label>
              <input id="nt-queue-full" type="number" min={limits.fullLimit.generalMin} max={limits.fullLimit.max} placeholder={general("fullLimit")} inputMode="numeric" value={form.fullLimit} onChange={(e) => set("fullLimit", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="nt-inline-ticket">
          <span>Vista previa</span>
          <strong>{preview}</strong>
          <small>Solo numeración de ejemplo</small>
        </div>
        <p className="nt-error" role="status" hidden={!error}>
          {error}
        </p>
      </div>
      <footer className="nt-dialog-footer">
        <button type="button" className="nt-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="nt-primary" disabled={store.saving}>
          {queue ? "Guardar cambios" : "Crear fila"}
        </button>
      </footer>
    </form>
  );
}

/** El formulario de una fila: nombre, modo, tiempo, color y, opcionalmente, sus propias reglas (vacío = usa la general). */
export const QueueDialog = observer(({ target, onClose }: Props) => (
  <Modal open={target !== null} onClose={onClose} labelledBy="nt-queue-dialog-title" className="nt-dialog nt-queue-dialog">
    {target && <Form queue={target.queue} onClose={onClose} />}
  </Modal>
));
