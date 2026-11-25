import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { AppDialog, Badge, CardHeading, Empty, Field, InfoBox, LineChart, PageHeading, QueueDot, Stat, Toggle, initials, toastStore } from "@/modules/business-dashboard";
import { operationApi } from "../api/operationApi";
import { useRemote } from "../hooks/useRemote";
import { operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** Una fecha `AAAA-MM-DD` como día de la semana, sin que la zona del navegador la corra de día. */
const weekday = (day: string) => WEEKDAY[new Date(`${day}T12:00:00`).getDay()];
const avg = (value: number | null) => (value === null ? "—" : value.toFixed(1));
/** «Encuestas»: la satisfacción de los clientes, calculada solo de las respuestas reales (sin respuestas, «—»). */
export const SurveysSection = observer(() => {
  const store = operationStore;
  const [queueId, setQueueId] = useState("all");
  const [sentiment, setSentiment] = useState<"all" | "positive" | "negative">("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const summary = useRemote(() => store.run((token, role, businessId) => operationApi.surveySummary(token, role, businessId, { range: "7d", queueId: queueId === "all" ? undefined : queueId })), [queueId]);
  const responses = useRemote(() => store.run((token, role, businessId) => operationApi.surveyResponses(token, role, businessId, { range: "30d", queueId: queueId === "all" ? undefined : queueId, pageSize: 60 })), [queueId]);
  const overall = summary.data?.overall;
  const distribution = overall?.distribution ?? { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const total = overall?.responses ?? 0;
  const positive = distribution["4"] + distribution["5"];
  const negative = distribution["1"] + distribution["2"];
  const items = (responses.data?.items ?? []).filter((item) => sentiment === "all" || (sentiment === "positive" ? item.rating >= 4 : item.rating <= 2));
  const trend = summary.data?.trend ?? [];
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title="Escucha lo que conecta."
        description={store.isAdmin ? "Conoce la experiencia de tus clientes y encuentra oportunidades para mejorar." : "Opiniones de los clientes de tus filas asignadas."}
        actions={
          <>
            {store.isAdmin ? (
              <button type="button" className="nd-secondary" onClick={() => setSettingsOpen(true)}>
                Configurar encuesta
              </button>
            ) : null}
            <button type="button" className="nd-primary" onClick={() => setPreviewOpen(true)}>
              Previsualizar
            </button>
          </>
        }
      />
      <div id="nd-content">
        {summary.error ? <InfoBox title="No pudimos cargar las encuestas">{summary.error}</InfoBox> : null}
        {store.isAdmin && store.config && !store.config.survey.enabled ? (
          <InfoBox title="La encuesta está apagada">Mientras esté apagada, nadie recibe invitaciones al completar un turno. Actívala en «Configurar encuesta».</InfoBox>
        ) : null}
        <div className="nd-stat-grid">
          <Stat label="Calificación promedio" value={avg(overall?.average ?? null)} unit={total ? "/ 5" : ""} icon="star" foot="Últimos 7 días" />
          <Stat label="Respuestas recibidas" value={total} icon="message" foot={overall?.responseRate != null ? `${overall.responseRate}% de las invitaciones` : "Últimos 7 días"} />
          <Stat label="Experiencias positivas" value={positive} icon="check" foot="Calificaciones de 4 y 5 estrellas" />
          <Stat label="A mejorar" value={negative} icon="activity" foot="Calificaciones de 1 y 2 estrellas" />
        </div>
        {negative > 0 ? (
          <section className="nd-survey-alert">
            <div>
              <h2>{negative} experiencias necesitan tu atención</h2>
              <p>Escuchar también es una forma de conectar. Revisa lo que podemos mejorar.</p>
            </div>
            <button
              type="button"
              className="nd-secondary"
              onClick={() => {
                setSentiment("negative");
                grid.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Ver opiniones bajas
            </button>
          </section>
        ) : null}
        <div className="nd-survey-charts">
          <section className="nd-card nd-pad">
            <CardHeading title="La experiencia a lo largo del tiempo" description="Promedio de las opiniones por día" />
            <LineChart values={trend.map((point) => point.average ?? 0)} labels={trend.map((point) => weekday(point.day))} title="Calificación promedio por día" />
          </section>
          <section className="nd-card nd-pad">
            <CardHeading title="Cada opinión cuenta" description="Distribución de las calificaciones" />
            {([5, 4, 3, 2, 1] as const).map((rating) => (
              <div key={rating} className="nd-rating-row">
                <span>{rating} ★</span>
                <div className="nd-progress-track">
                  <span style={{ width: `${total ? (distribution[String(rating) as "1"] / total) * 100 : 0}%` }} />
                </div>
                <b>{distribution[String(rating) as "1"]}</b>
              </div>
            ))}
          </section>
          <section className="nd-card nd-pad">
            <CardHeading title="Satisfacción por fila" description="Promedio sobre 5 estrellas" />
            {store.queues.map((queue) => {
              const row = summary.data?.byQueue.find((item) => item.queueId === queue.id);
              return (
                <div key={queue.id} className="nd-queue-mini" style={{ margin: "16px 0" }}>
                  <QueueDot color={queue.color} />
                  <div>
                    <strong>{queue.name}</strong>
                    <div className="nd-progress-track">
                      <span style={{ width: `${((row?.average ?? 0) / 5) * 100}%` }} />
                    </div>
                  </div>
                  <b>{avg(row?.average ?? null)}</b>
                </div>
              );
            })}
          </section>
        </div>
        {store.isAdmin ? (
          <section className="nd-card" style={{ marginTop: 22 }}>
            <div className="nd-pad" style={{ paddingBottom: 0 }}>
              <CardHeading title="Encuestas por operador" description="Opiniones de los clientes atendidos por cada persona" />
            </div>
            <div className="nd-table-wrap">
              <table className="nd-table">
                <thead>
                  <tr>
                    <th scope="col">OPERADOR</th>
                    <th scope="col">RESPUESTAS</th>
                    <th scope="col">PROMEDIO</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.data?.byOperator ?? []).map((row) => (
                    <tr key={row.operatorId}>
                      <td>
                        <div className="nd-person-cell">
                          <span className="nd-avatar">{initials(row.operatorName)}</span>
                          <strong>{row.operatorName}</strong>
                        </div>
                      </td>
                      <td>{row.responses}</td>
                      <td>{avg(row.average)}</td>
                    </tr>
                  ))}
                  {(summary.data?.byOperator ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <p className="nd-muted nd-pad">Todavía no hay opiniones por operador.</p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <div className="nd-section-heading" ref={grid}>
          <div>
            <h2>Historias detrás de cada turno</h2>
            <p>Los comentarios más recientes de tus clientes.</p>
          </div>
          <div className="nd-comments-tools">
            <div className="nd-segmented" role="group" aria-label="Tipo de opinión">
              {([["all", "Todas"], ["positive", "Positivas"], ["negative", "A mejorar"]] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={sentiment === value} onClick={() => setSentiment(value)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="nd-sr-only" htmlFor="nd-survey-queue">
              Fila de las opiniones
            </label>
            <select id="nd-survey-queue" value={queueId} onChange={(event) => setQueueId(event.target.value)}>
              <option value="all">Todas mis filas</option>
              {store.queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nd-response-grid">
          {items.map((item) => (
            <article key={item.id} className="nd-card nd-response-card">
              <header>
                <div>
                  <strong>{`Turno ${item.ticketCode}`}</strong>
                  <small>{`${item.queue.name}${item.operator?.name ? ` · ${item.operator.name}` : ""}`}</small>
                </div>
                <span className="nd-stars" aria-label={`${item.rating} de 5 estrellas`}>
                  {"★".repeat(item.rating)}
                  {"☆".repeat(5 - item.rating)}
                </span>
              </header>
              <p>{item.comment ? `“${item.comment}”` : "Sin comentario."}</p>
              <footer>
                <Badge>{new Date(item.answeredAt).toLocaleDateString("es", { day: "numeric", month: "short" })}</Badge>
              </footer>
            </article>
          ))}
        </div>
        {items.length === 0 && responses.data ? <Empty title="Sin opiniones con este filtro" text="Prueba otra fila o tipo de experiencia." /> : null}
      </div>
      {settingsOpen ? <SurveySettings onClose={() => setSettingsOpen(false)} /> : null}
      <SurveyPreview open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
});
function SurveySettings({ onClose }: { onClose: () => void }) {
  const survey = operationStore.config?.survey;
  const [enabled, setEnabled] = useState(survey?.enabled ?? false);
  const [question, setQuestion] = useState(survey?.question ?? "");
  const [thanks, setThanks] = useState(survey?.thanksMessage ?? "");
  const [allowComment, setAllowComment] = useState(survey?.allowComment ?? true);
  const [email, setEmail] = useState(survey?.channels.email ?? true);
  const [hours, setHours] = useState(String(survey?.validHours ?? 72));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (question.trim().length < 2) return setError("Escribe una pregunta para el cliente.");
    const validHours = Number(hours);
    if (!Number.isInteger(validHours) || validHours < 1 || validHours > 720) return setError("La vigencia del enlace debe estar entre 1 y 720 horas.");
    setBusy(true);
    try {
      await operationStore.run((token) =>
        operationApi.saveSurvey(token, operationStore.businessId, {
          enabled,
          channels: { email, whatsapp: false },
          question: question.trim(),
          allowComment,
          thanksMessage: thanks.trim() || null,
          validHours,
          queueIds: survey?.queueIds ?? null,
        }),
      );
      await operationStore.readScope();
      toastStore.announce("Encuesta guardada.");
      onClose();
    } catch (reason) {
      setError(operationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog open title="Una opinión también conecta." submitLabel="Guardar encuesta" busy={busy} error={error} onClose={onClose} onSubmit={save}>
      <Field id="nd-survey-question" label="Pregunta para el cliente" required>
        <textarea id="nd-survey-question" rows={3} maxLength={140} value={question} onChange={(event) => setQuestion(event.target.value)} />
      </Field>
      <Field id="nd-survey-thanks" label={<>Mensaje de agradecimiento <small>Opcional</small></>}>
        <input id="nd-survey-thanks" maxLength={200} value={thanks} onChange={(event) => setThanks(event.target.value)} />
      </Field>
      <div className="nd-permission-item">
        <div>
          <strong>Encuesta habilitada</strong>
          <small>Se envía al completar un turno si el cliente dejó su correo.</small>
        </div>
        <Toggle checked={enabled} label="Habilitar encuesta" onChange={setEnabled} />
      </div>
      <div className="nd-permission-item">
        <div>
          <strong>Enviar por correo</strong>
          <small>Si el correo no está configurado en el servidor, el envío queda registrado como «no configurado».</small>
        </div>
        <Toggle checked={email} label="Enviar por correo" onChange={setEmail} />
      </div>
      <div className="nd-permission-item">
        <div>
          <strong>Enviar por WhatsApp</strong>
          <small>Todavía no está disponible: no hay un proveedor conectado.</small>
        </div>
        <Toggle checked={false} disabled label="Enviar por WhatsApp" onChange={() => undefined} />
      </div>
      <div className="nd-permission-item">
        <div>
          <strong>Solicitar un comentario</strong>
          <small>El cliente puede compartir su experiencia.</small>
        </div>
        <Toggle checked={allowComment} label="Solicitar comentario" onChange={setAllowComment} />
      </div>
      <Field id="nd-survey-hours" label="Vigencia del enlace (horas)">
        <input id="nd-survey-hours" type="number" min={1} max={720} value={hours} onChange={(event) => setHours(event.target.value)} />
      </Field>
    </AppDialog>
  );
}
function SurveyPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const survey = operationStore.config?.survey;
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setRating(0);
      setError(null);
    }
  }, [open]);
  return (
    <AppDialog
      open={open}
      title="Así se siente tu encuesta"
      eyebrow="VISTA PREVIA · SIN ENVÍO"
      submitLabel="Probar confirmación"
      error={error}
      onClose={onClose}
      onSubmit={() => {
        if (!rating) return setError("Selecciona una calificación para probar la confirmación.");
        onClose();
        toastStore.announce(survey?.thanksMessage ?? "Gracias por compartir tu experiencia. Esta fue una prueba: no se guardó nada.");
      }}
    >
      <div className="nd-survey-preview">
        <h3>{survey?.question ?? "¿Cómo calificas la atención que recibiste?"}</h3>
        <div className="nd-survey-stars" role="group" aria-label="Calificación de ejemplo">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" aria-label={`${value} estrellas`} aria-pressed={rating === value} onClick={() => setRating(value)}>
              {value <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        {survey?.allowComment !== false ? (
          <Field id="nd-preview-comment" label={<>Cuéntanos un poco más <small>Opcional</small></>}>
            <textarea id="nd-preview-comment" rows={3} maxLength={300} placeholder="Tu experiencia nos ayuda a mejorar." />
          </Field>
        ) : null}
      </div>
    </AppDialog>
  );
}
