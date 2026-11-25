import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge, Empty, Field, Icon, InfoBox, PageHeading, QueueDot } from "@/modules/business-dashboard";
import type { QueueField } from "../../types";
import { operationApi } from "../api/operationApi";
import { customerName, newRequestId } from "../format";
import { useRemote } from "../hooks/useRemote";
import { operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
import { base } from "./DashboardSection";
const phoneDigits = (value: string) => value.replace(/\D/g, "");
/** «Crear turno»: elegir la fila, pedir lo que esa fila necesita y registrar al cliente. El servidor numera y valida de nuevo. */
export const CreateSection = observer(() => {
  const store = operationStore;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queues = store.queues.filter((queue) => queue.status !== "paused");
  const [queueId, setQueueId] = useState<string | null>(params.get("queue"));
  const selected = queues.find((queue) => queue.id === queueId) ?? queues[0];
  const board = useRemote(() => store.run((token, role, businessId) => operationApi.board(token, role, businessId)), []);
  const requestId = useRef(newRequestId());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAnswers({});
    setError(null);
  }, [selected?.id]);
  if (!selected) {
    return (
      <>
        <PageHeading eyebrow="TURNOS · TU OPERACIÓN" title="Una nueva conexión comienza aquí." description="Registra un turno en una de tus filas." />
        <div id="nd-content">
          <Empty
            title="No hay filas disponibles"
            text="Las filas están en pausa o no tienes una asignación activa."
            action={
              store.can("queues") ? (
                <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, "queues"))}>
                  Revisar filas
                </button>
              ) : undefined
            }
          />
        </div>
      </>
    );
  }
  const waitingOf = (id: string) => board.data?.find((entry) => entry.queue.id === id)?.waiting ?? 0;
  const waiting = waitingOf(selected.id);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    let message = "";
    if (name.trim().length < 2) message = "Escribe un nombre de al menos 2 caracteres.";
    else if (phoneDigits(phone).length < 7) message = "Escribe un teléfono de contacto válido.";
    else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) message = "Revisa el correo del cliente.";
    const sent: Record<string, unknown> = {};
    if (!message) {
      for (const field of selected.fields) {
        const value = answers[field.id];
        const text = typeof value === "string" ? value.trim() : "";
        if (field.type === "checkbox") {
          if (field.required && value !== true) {
            message = `Acepta el campo ${field.label}.`;
            break;
          }
          if (typeof value === "boolean") sent[field.id] = value;
          continue;
        }
        if (field.required && !text) {
          message = `Completa el campo ${field.label}.`;
          break;
        }
        if (field.type === "number" && text && !Number.isFinite(Number(text))) {
          message = `Revisa el campo ${field.label}.`;
          break;
        }
        if (text) sent[field.id] = text;
      }
    }
    setError(message || null);
    if (message) return;
    setBusy(true);
    try {
      const result = await store.run((token, role, businessId) =>
        operationApi.create(token, role, businessId, selected.id, {
          customerName: name.trim(),
          customerPhone: phone.trim(),
          ...(email.trim() ? { customerEmail: email.trim() } : {}),
          answers: sent,
          clientRequestId: requestId.current,
        }),
      );
      requestId.current = newRequestId();
      store.bump();
      navigate(base(store.businessId, `created/${result.ticket.id}`));
    } catch (reason) {
      setError(operationErrorMessage(reason));
      if (reason instanceof Error && "code" in reason && (reason as { code?: string }).code === "queue-paused") void store.readScope();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading eyebrow="TURNOS · TU OPERACIÓN" title="Una nueva conexión comienza aquí." description="Registra un turno en una de tus filas. El número lo asigna el servidor." />
      <div id="nd-content">
        <div className="nd-form-heading">¿En qué fila creas el turno?</div>
        <fieldset className="nd-queue-picker" style={{ border: 0, padding: 0 }}>
          <legend className="nd-sr-only">Fila del nuevo turno</legend>
          {queues.map((queue) => (
            <label key={queue.id} className="nd-queue-choice">
              <input type="radio" name="nd-create-queue" value={queue.id} checked={selected.id === queue.id} onChange={() => setQueueId(queue.id)} />
              <strong>
                <QueueDot color={queue.color} />
                {queue.name}
              </strong>
              <small>{waitingOf(queue.id)} personas en espera</small>
            </label>
          ))}
        </fieldset>
        <div className="nd-create-layout">
          <form className="nd-card nd-create-form" noValidate onSubmit={submit}>
            <Field id="nd-client-name" label="Nombre del cliente" required>
              <input id="nd-client-name" autoComplete="name" maxLength={80} placeholder="Ej. María González" required value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field id="nd-client-phone" label="Teléfono de contacto / WhatsApp" required hint="Solo se guarda como dato de contacto del turno.">
              <input id="nd-client-phone" type="tel" autoComplete="tel" maxLength={25} placeholder="+57 300 123 4567" required value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field id="nd-client-email" label={<>Correo del cliente <small>Opcional</small></>} hint="Con un correo, el cliente puede recibir la encuesta de satisfacción.">
              <input id="nd-client-email" type="email" autoComplete="email" maxLength={160} placeholder="cliente@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            {selected.fields.length > 0 ? (
              <>
                <h2 className="nd-form-heading">Datos para {selected.name}</h2>
                <div>
                  {selected.fields.map((field) => (
                    <ExtraField key={field.id} field={field} value={answers[field.id]} onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))} />
                  ))}
                </div>
              </>
            ) : (
              <InfoBox>Esta fila solo solicita nombre y teléfono.</InfoBox>
            )}
            <p className="nd-error" role="status" hidden={!error}>
              {error}
            </p>
            <div className="nd-form-actions">
              <button type="submit" className="nd-primary" disabled={busy}>
                Crear turno
              </button>
            </div>
          </form>
          <aside className="nd-card nd-create-context">
            <h2>
              <QueueDot color={selected.color} />
              {selected.name}
            </h2>
            <div className="nd-queue-kpis">
              <div>
                <span>Personas en espera</span>
                <strong>{waiting}</strong>
              </div>
              <div>
                <span>Espera estimada</span>
                <strong>{waiting ? `~${waiting * selected.averageMinutes} min` : "Sin espera"}</strong>
                <small>{selected.averageMinutes} min por atención</small>
              </div>
            </div>
            <InfoBox title="Todo en su lugar">El turno seguirá el orden de atención de esta fila. Ejemplo de número: {selected.ticketExample}.</InfoBox>
          </aside>
        </div>
      </div>
    </>
  );
});
function ExtraField({ field, value, onChange }: { field: QueueField; value: string | boolean | undefined; onChange: (value: string | boolean) => void }) {
  const id = `nd-extra-${field.id}`;
  if (field.type === "checkbox") {
    return (
      <div className="nd-field">
        <label htmlFor={id} className="nd-toggle-label" style={{ justifyContent: "flex-start", gap: 12 }}>
          <input id={id} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
          <span>
            {field.label}
            {field.required ? <b> *</b> : null}
          </span>
        </label>
      </div>
    );
  }
  return (
    <Field id={id} label={field.label} required={field.required}>
      {field.type === "select" ? (
        <select id={id} value={typeof value === "string" ? value : ""} required={field.required} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecciona una opción</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          maxLength={200}
          required={field.required}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
/** La confirmación de un turno recién creado. */
export const CreatedSection = observer(({ ticketId }: { ticketId: string | undefined }) => {
  const store = operationStore;
  const navigate = useNavigate();
  const remote = useRemote(() => store.run((token, role, businessId) => operationApi.ticket(token, role, businessId, ticketId as string)), [ticketId], Boolean(ticketId));
  const ticket = remote.data;
  return (
    <>
      <PageHeading eyebrow="TURNOS · TU OPERACIÓN" title="Una buena atención empieza aquí." description="El turno ya forma parte de la fila." />
      <div id="nd-content">
        {!ticket ? (
          <Empty
            title={remote.loading ? "Abriendo el turno…" : "No encontramos ese turno"}
            text={remote.error ?? "Crea un turno para revisar su confirmación."}
            action={
              <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, "create"))}>
                Crear turno
              </button>
            }
          />
        ) : (
          <div className="nd-success-layout">
            <article className="nd-card nd-success-ticket">
              <header className="nd-success-head">
                <span className="nd-success-mark">
                  <Icon name="check" />
                </span>
                <p>Turno creado</p>
              </header>
              <div className="nd-success-body">
                <span className="nd-eyebrow">NÚMERO DE TURNO</span>
                <h2>{ticket.code}</h2>
                <dl className="nd-ticket-data">
                  <div>
                    <dt>Cliente</dt>
                    <dd>{customerName(ticket)}</dd>
                  </div>
                  <div>
                    <dt>Fila</dt>
                    <dd>{ticket.queue.name}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{ticket.status === "waiting" ? "En espera" : ticket.status === "attending" ? "En atención" : "Finalizado"}</dd>
                  </div>
                  {ticket.answers.map((answer) => (
                    <div key={answer.fieldId}>
                      <dt>{answer.label}</dt>
                      <dd>{typeof answer.value === "boolean" ? (answer.value ? "Sí" : "No") : String(answer.value)}</dd>
                    </div>
                  ))}
                </dl>
                <Badge color="purple">{`Creado por ${ticket.createdBy.name}`}</Badge>
              </div>
              <footer className="nd-success-actions">
                <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, "create"))}>
                  Crear otro turno
                </button>
                {store.can("queues") ? (
                  <button type="button" className="nd-secondary" onClick={() => navigate(base(store.businessId, `board/${ticket.queue.id}`))}>
                    Ver la fila
                  </button>
                ) : store.can("my-turns") ? (
                  <button type="button" className="nd-secondary" onClick={() => navigate(base(store.businessId, "tickets"))}>
                    Ver mis turnos
                  </button>
                ) : null}
              </footer>
            </article>
          </div>
        )}
      </div>
    </>
  );
});
