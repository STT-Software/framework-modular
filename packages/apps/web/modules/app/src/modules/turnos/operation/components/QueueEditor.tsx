import { useEffect, useState } from "react";
import { AppDialog, Badge, Field, Icon, QUEUE_HEX, Toggle } from "@/modules/business-dashboard";
import { turnosApi } from "../../api/turnosApi";
import { firstIssue, turnosErrorMessage } from "../../messages";
import type { FieldType, QueueColor, QueueMode, TurnosQueue } from "../../types";
import { operationStore } from "../stores/operation.store";
import { toastStore } from "@/modules/business-dashboard";
import { TurnosError } from "../../api/turnosApi";
const COLOR_NAMES: Record<QueueColor, string> = { orange: "Naranja", purple: "Morado", blue: "Azul", green: "Verde", pink: "Rosa", amber: "Ámbar" };
const FIELD_TYPE_NAMES: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  phone: "Teléfono",
  email: "Correo",
  date: "Fecha",
  select: "Selección",
  checkbox: "Casilla",
};
interface DraftField {
  key: string;
  id?: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string;
}
const GENERAL_HINT = (config: NonNullable<typeof operationStore.config>, key: "urgentMinutes" | "busyLimit" | "fullLimit") => `General: ${config.rules[key]}`;
/** Crear o editar una fila, con sus reglas propias y los datos que pide al crear un turno. Solo el administrador. */
export function QueueEditor({ queueId, open, onClose }: { queueId: string | null; open: boolean; onClose: () => void }) {
  const config = operationStore.config;
  const queue: TurnosQueue | undefined = queueId ? config?.queues.find((item) => item.id === queueId) : undefined;
  const [name, setName] = useState("");
  const [mode, setMode] = useState<QueueMode>("auto");
  const [average, setAverage] = useState("15");
  const [color, setColor] = useState<QueueColor>("orange");
  const [prefix, setPrefix] = useState("");
  const [urgent, setUrgent] = useState("");
  const [busyLimit, setBusyLimit] = useState("");
  const [fullLimit, setFullLimit] = useState("");
  const [fields, setFields] = useState<DraftField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(queue?.name ?? "");
    setMode(queue?.mode ?? "auto");
    setAverage(String(queue?.averageMinutes ?? 15));
    setColor(queue?.color ?? "orange");
    setPrefix(queue?.overrides.prefix ?? "");
    setUrgent(queue?.overrides.urgentMinutes?.toString() ?? "");
    setBusyLimit(queue?.overrides.busyLimit?.toString() ?? "");
    setFullLimit(queue?.overrides.fullLimit?.toString() ?? "");
    setFields((queue?.fields ?? []).map((field) => ({ key: field.id, id: field.id, label: field.label, type: field.type, required: field.required, options: field.options.join(", ") })));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queueId]);
  if (!config) return null;
  const limits = config.catalog.limits;
  const update = (key: string, patch: Partial<DraftField>) => setFields((list) => list.map((field) => (field.key === key ? { ...field, ...patch } : field)));
  const save = async () => {
    const trimmed = name.trim();
    const minutes = Number(average);
    if (trimmed.length < limits.queueName.min) return setError(`Escribe un nombre de al menos ${limits.queueName.min} caracteres.`);
    if (!Number.isInteger(minutes) || minutes < limits.averageMinutes.min || minutes > limits.averageMinutes.max) return setError(`El tiempo promedio debe estar entre ${limits.averageMinutes.min} y ${limits.averageMinutes.max} minutos.`);
    const labels = new Set<string>();
    for (const field of fields) {
      if (field.label.trim().length < limits.fieldLabel.min) return setError("Cada campo adicional necesita un nombre.");
      if (labels.has(field.label.trim().toLowerCase())) return setError("Los campos adicionales no deben repetir nombres.");
      labels.add(field.label.trim().toLowerCase());
      if (field.type === "select" && new Set(field.options.split(",").map((option) => option.trim()).filter(Boolean)).size < limits.fieldOptions.min) {
        return setError("Un campo de selección necesita al menos dos opciones diferentes.");
      }
    }
    const number = (value: string) => (value.trim() === "" ? null : Number(value));
    const body = {
      name: trimmed,
      mode,
      averageMinutes: minutes,
      color,
      overrides: { prefix: prefix.trim() === "" ? null : prefix.trim(), urgentMinutes: number(urgent), busyLimit: number(busyLimit), fullLimit: number(fullLimit) },
      fields: fields.map((field) => ({
        ...(field.id ? { id: field.id } : {}),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: field.type === "select" ? [...new Set(field.options.split(",").map((option) => option.trim()).filter(Boolean))] : [],
      })),
    };
    setBusy(true);
    setError(null);
    try {
      const state = await operationStore.run((token) => (queue ? turnosApi.updateQueue(token, operationStore.businessId, queue.id, body) : turnosApi.createQueue(token, operationStore.businessId, body)));
      operationStore.applyConfig(state);
      operationStore.bump();
      toastStore.announce(queue ? "Fila actualizada." : "Fila creada.");
      onClose();
    } catch (reason) {
      setError(reason instanceof TurnosError && Object.keys(reason.fields).length > 0 ? (firstIssue(reason.fields) ?? turnosErrorMessage(reason)) : turnosErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog
      open={open}
      wide
      title={queue ? "Editar fila" : "Crear una nueva fila"}
      description="Define cómo atiendes y qué datos necesitas en esta fila."
      submitLabel={queue ? "Guardar cambios" : "Crear fila"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={save}
    >
      <Field id="nd-q-name" label="Nombre de la fila" required>
        <input id="nd-q-name" maxLength={limits.queueName.max} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Consulta general" />
      </Field>
      <div className="nd-field-grid">
        <Field id="nd-q-mode" label="Modo de atención">
          <select id="nd-q-mode" value={mode} onChange={(event) => setMode(event.target.value as QueueMode)}>
            <option value="auto">Automático</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
        <Field id="nd-q-average" label="Tiempo promedio por atención">
          <div className="nd-unit">
            <input id="nd-q-average" type="number" min={limits.averageMinutes.min} max={limits.averageMinutes.max} value={average} onChange={(event) => setAverage(event.target.value)} />
            <span>min</span>
          </div>
        </Field>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 22px" }}>
        <legend style={{ fontSize: 13 }}>Color de la fila</legend>
        <div className="nd-color-options">
          {config.catalog.colors.map((option) => (
            <label key={option} style={{ ["--color" as string]: QUEUE_HEX[option] }}>
              <input type="radio" name="nd-q-color" aria-label={COLOR_NAMES[option]} value={option} checked={color === option} onChange={() => setColor(option)} />
              <span />
            </label>
          ))}
        </div>
      </fieldset>
      <section className="nd-override-section">
        <h3>
          <Icon name="settings" />
          Reglas de esta fila <Badge>Opcionales</Badge>
        </h3>
        <p>Los campos vacíos heredan su valor de las reglas generales de Turnos.</p>
        <Field id="nd-q-prefix" label="Prefijo del turno">
          <input
            id="nd-q-prefix"
            maxLength={limits.prefix.max}
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            placeholder={config.rules.prefixMode === "initial" ? "General: inicial de la fila" : config.rules.prefixMode === "fixed" ? `General: ${config.rules.fixedPrefix}` : "General: solo números"}
          />
        </Field>
        <div className="nd-field-grid">
          <Field id="nd-q-urgent" label="Urgente desde (min)">
            <input id="nd-q-urgent" type="number" min={1} value={urgent} onChange={(event) => setUrgent(event.target.value)} placeholder={GENERAL_HINT(config, "urgentMinutes")} />
          </Field>
          <Field id="nd-q-busy" label="Ocupada desde">
            <input id="nd-q-busy" type="number" min={1} value={busyLimit} onChange={(event) => setBusyLimit(event.target.value)} placeholder={GENERAL_HINT(config, "busyLimit")} />
          </Field>
          <Field id="nd-q-full" label="Llena desde">
            <input id="nd-q-full" type="number" min={1} value={fullLimit} onChange={(event) => setFullLimit(event.target.value)} placeholder={GENERAL_HINT(config, "fullLimit")} />
          </Field>
        </div>
      </section>
      <section>
        <div className="nd-builder-header">
          <div>
            <h3>Campos al crear un turno</h3>
            <p>El nombre y el teléfono del cliente siempre se piden.</p>
          </div>
          <button
            type="button"
            className="nd-secondary"
            onClick={() => (fields.length >= limits.fieldsPerQueue ? setError(`Puedes añadir hasta ${limits.fieldsPerQueue} campos.`) : setFields((list) => [...list, { key: `new-${Date.now()}`, label: "", type: "text", required: false, options: "" }]))}
          >
            Agregar campo
          </button>
        </div>
        <div>
          {fields.length === 0 ? <div className="nd-column-empty">Sin datos adicionales. Solo se pedirán nombre y teléfono.</div> : null}
          {fields.map((field, index) => (
            <div key={field.key} className="nd-custom-field">
              <div className="nd-field-grid">
                <Field id={`nd-cf-label-${index}`} label="Nombre del campo">
                  <input id={`nd-cf-label-${index}`} maxLength={limits.fieldLabel.max} value={field.label} onChange={(event) => update(field.key, { label: event.target.value })} placeholder="Ej. Motivo de consulta" />
                </Field>
                <Field id={`nd-cf-type-${index}`} label="Tipo">
                  <select id={`nd-cf-type-${index}`} value={field.type} onChange={(event) => update(field.key, { type: event.target.value as FieldType })}>
                    {config.catalog.fieldTypes.map((type) => (
                      <option key={type} value={type}>
                        {FIELD_TYPE_NAMES[type]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {field.type === "select" ? (
                <Field id={`nd-cf-options-${index}`} label="Opciones separadas por coma">
                  <input id={`nd-cf-options-${index}`} value={field.options} onChange={(event) => update(field.key, { options: event.target.value })} placeholder="Ej. Primera vez, Control" />
                </Field>
              ) : null}
              <footer>
                <Toggle text="Obligatorio" checked={field.required} label={`Campo ${index + 1} obligatorio`} onChange={(value) => update(field.key, { required: value })} />
                <button type="button" className="nd-icon-button" aria-label={`Quitar campo ${index + 1}`} onClick={() => setFields((list) => list.filter((item) => item.key !== field.key))}>
                  <Icon name="trash" />
                </button>
              </footer>
            </div>
          ))}
        </div>
      </section>
    </AppDialog>
  );
}
