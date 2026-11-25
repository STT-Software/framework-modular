import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Empty, Icon, InfoBox, PageHeading, toastStore } from "@/modules/business-dashboard";
import { turnosApi } from "../../api/turnosApi";
import type { QueueMode, TurnosQueue } from "../../types";
import { operationApi } from "../api/operationApi";
import { customerName, waitOf } from "../format";
import { useAct } from "../hooks/useAct";
import { useRemote } from "../hooks/useRemote";
import { operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
import type { Ticket } from "../types";
import { base } from "./DashboardSection";
import { TicketDetail } from "./TicketsSection";
/** Lo que se reenvía al servidor al cambiar solo el modo de una fila: todo lo demás queda como está. */
function bodyWith(queue: TurnosQueue, mode: QueueMode) {
  return {
    name: queue.name,
    mode,
    averageMinutes: queue.averageMinutes,
    color: queue.color,
    overrides: { ...queue.overrides },
    fields: queue.fields.map((field) => ({ id: field.id, label: field.label, type: field.type, required: field.required, options: field.options })),
  };
}
/** El tablero de una fila: esperando, atendiendo y completados de hoy, con llamar, atender y terminar. */
export const BoardSection = observer(({ queueId }: { queueId: string | undefined }) => {
  const store = operationStore;
  const navigate = useNavigate();
  const { act, busy } = useAct();
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const queue = queueId ? store.queueById(queueId) : undefined;
  const canWork = store.can("my-turns");
  const open = useRemote(
    () => store.run((token, role, businessId) => operationApi.tickets(token, role, businessId, { queueId, status: ["waiting", "attending"], order: "arrival", pageSize: 100 })),
    [queueId],
    Boolean(queue) && canWork,
  );
  const done = useRemote(
    () => store.run((token, role, businessId) => operationApi.tickets(token, role, businessId, { queueId, status: ["completed"], range: "today", pageSize: 40 })),
    [queueId],
    Boolean(queue) && canWork,
  );
  const mine = useRemote(() => store.run((token, role, businessId) => operationApi.current(token, role, businessId)), [], Boolean(queue) && canWork);
  if (!queue || !queueId) {
    return (
      <>
        <PageHeading eyebrow="TURNOS · TU OPERACIÓN" title="Esta fila no está disponible." description="Revisa tus filas asignadas para continuar." />
        <div id="nd-content">
          <Empty
            title="Sin acceso a esta fila"
            text="Solo puedes abrir filas que correspondan a tu acceso."
            action={
              <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, "queues"))}>
                Ver mis filas
              </button>
            }
          />
        </div>
      </>
    );
  }
  const waiting = (open.data?.items ?? []).filter((ticket) => ticket.status === "waiting");
  const attending = (open.data?.items ?? []).filter((ticket) => ticket.status === "attending");
  const current = mine.data && mine.data.queue.id === queue.id ? mine.data : null;
  const elsewhere = mine.data && mine.data.queue.id !== queue.id ? mine.data : null;
  const next = waiting[0];
  const paused = queue.status === "paused";
  const match = (ticket: Ticket) => `${ticket.code} ${customerName(ticket)}`.toLowerCase().includes(search.toLowerCase());
  const refresh = () => {
    open.reload();
    done.reload();
    mine.reload();
  };
  const call = (ticket: Ticket) => void act(() => store.run((token, role, businessId) => operationApi.act(token, role, businessId, ticket.id, "call")), (result) => `${result.ticket.code} pasó a atención.`).then(refresh);
  const callNext = () =>
    void act(() => store.run((token, role, businessId) => operationApi.callNext(token, role, businessId, queue.id)), (result) => `${result.ticket.code} pasó a atención.`).then(refresh);
  const finish = (ticket: Ticket, action: "complete" | "no-show") =>
    void act(
      () => store.run((token, role, businessId) => operationApi.act(token, role, businessId, ticket.id, action)),
      (result) => (action === "no-show" ? `${result.ticket.code} quedó como ausente.` : result.next ? `Turno completado. ${result.next.code} pasó a atención.` : "Turno completado."),
    ).then(refresh);
  const setMode = async (mode: QueueMode) => {
    const source = store.config?.queues.find((item) => item.id === queue.id);
    if (!source || source.mode === mode) return;
    try {
      const state = await store.run((token) => turnosApi.updateQueue(token, store.businessId, queue.id, bodyWith(source, mode)));
      store.applyConfig(state);
      store.bump();
      toastStore.announce("Modo de atención actualizado.");
    } catch (error) {
      toastStore.announce(operationErrorMessage(error));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title={queue.name}
        description={`${waiting.length} ${waiting.length === 1 ? "persona esperando" : "personas esperando"} · ${paused ? "Recepción de turnos en pausa" : "Fila activa"}`}
        actions={
          <>
            <button type="button" className="nd-secondary" onClick={() => navigate(base(store.businessId, "queues"))}>
              Volver a filas
            </button>
            {store.can("create-turn") && !paused ? (
              <button type="button" className="nd-primary" onClick={() => navigate(`${base(store.businessId, "create")}?queue=${queue.id}`)}>
                Crear turno aquí
              </button>
            ) : null}
          </>
        }
      />
      <div id="nd-content">
        <div className="nd-board-meta">
          <Badge color="purple">{`Prefijo ${queue.effective.prefix || "numérico"}`}</Badge>
          <Badge color={queue.mode === "auto" ? "orange" : ""}>{queue.mode === "auto" ? "Atención automática" : "Atención manual"}</Badge>
          <Badge color="blue">{`${queue.averageMinutes} min por atención`}</Badge>
          <Badge color="orange">{`Urgente desde ${queue.effective.urgentMinutes} min`}</Badge>
          {store.isAdmin ? (
            <div className="nd-segmented" role="group" aria-label={`Modo de atención de ${queue.name}`}>
              <button type="button" aria-pressed={queue.mode === "auto"} onClick={() => void setMode("auto")}>
                Automático
              </button>
              <button type="button" aria-pressed={queue.mode === "manual"} onClick={() => void setMode("manual")}>
                Manual
              </button>
            </div>
          ) : null}
        </div>
        {!canWork ? (
          <InfoBox title="Solo el resumen">Tu perfil puede ver el estado de esta fila, pero no incluye la vista «Mis turnos» para atender a las personas.</InfoBox>
        ) : (
          <>
            <div className={`nd-operation-bar ${queue.mode === "auto" ? "is-auto" : ""}`}>
              <div>
                <h3>{current ? `Atendiendo ${current.code} · ${customerName(current)}` : elsewhere ? `Tienes ${elsewhere.code} en atención` : "Sin turno en atención"}</h3>
                <p>
                  {elsewhere
                    ? `Está en la fila ${elsewhere.queue.name}. Termínalo antes de llamar a otra persona.`
                    : queue.mode === "auto"
                      ? "Al completar una atención, se llama al siguiente turno por orden de llegada."
                      : next
                        ? `Siguiente en fila: ${next.code}`
                        : "No hay personas esperando."}
                </p>
              </div>
              <div className="nd-row-actions">
                {!current && !elsewhere && next ? (
                  <button type="button" className="nd-primary" disabled={busy} onClick={callNext}>
                    {queue.mode === "auto" ? "Iniciar atención automática" : "Llamar siguiente"}
                  </button>
                ) : null}
                {current ? (
                  <>
                    <button type="button" className="nd-primary" disabled={busy} onClick={() => finish(current, "complete")}>
                      Terminar turno
                    </button>
                    <button type="button" className="nd-secondary" disabled={busy} onClick={() => finish(current, "no-show")}>
                      No asistió
                    </button>
                  </>
                ) : null}
                {elsewhere ? (
                  <button type="button" className="nd-secondary" onClick={() => navigate(base(store.businessId, `board/${elsewhere.queue.id}`))}>
                    Ir a esa fila
                  </button>
                ) : null}
              </div>
            </div>
            <div className="nd-input-search" style={{ marginBottom: 22 }}>
              <Icon name="search" />
              <input type="search" aria-label="Buscar en esta fila" placeholder="Buscar por nombre o número de turno" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="nd-kanban">
              <Column label="ESPERANDO" empty="Nadie esperando" tickets={waiting.filter(match)}>
                {(ticket, index) => {
                  const urgent = waitOf(ticket) >= queue.effective.urgentMinutes;
                  const head = waiting[0]?.id === ticket.id;
                  const canCall = !current && !elsewhere && (queue.mode === "manual" || head);
                  return (
                    <Card key={ticket.id} ticket={ticket} urgent={urgent} onDetail={() => setDetailId(ticket.id)}>
                      {canCall ? (
                        <button type="button" className="nd-primary" disabled={busy || index < 0} onClick={() => call(ticket)}>
                          Atender
                        </button>
                      ) : null}
                    </Card>
                  );
                }}
              </Column>
              <Column label="ATENDIENDO" empty="Nadie en atención" tickets={attending.filter(match)}>
                {(ticket) => (
                  <Card key={ticket.id} ticket={ticket} serving onDetail={() => setDetailId(ticket.id)}>
                    {current?.id === ticket.id ? (
                      <button type="button" className="nd-primary" disabled={busy} onClick={() => finish(ticket, "complete")}>
                        Completar
                      </button>
                    ) : (
                      <small>{ticket.attendedBy ? `Con ${ticket.attendedBy.name}` : ""}</small>
                    )}
                  </Card>
                )}
              </Column>
              <Column label="LISTOS HOY" empty="Aún no hay turnos completados" tickets={(done.data?.items ?? []).filter(match)}>
                {(ticket) => <Card key={ticket.id} ticket={ticket} finished onDetail={() => setDetailId(ticket.id)} />}
              </Column>
            </div>
          </>
        )}
      </div>
      <TicketDetail ticketId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
});
function Column({ label, empty, tickets, children }: { label: string; empty: string; tickets: Ticket[]; children: (ticket: Ticket, index: number) => React.ReactNode }) {
  return (
    <section className="nd-kanban-column" aria-label={label}>
      <header>
        {label}
        <span>{tickets.length}</span>
      </header>
      <div>{tickets.length ? tickets.map(children) : <div className="nd-column-empty">{empty}</div>}</div>
    </section>
  );
}
function Card({ ticket, urgent, serving, finished, onDetail, children }: { ticket: Ticket; urgent?: boolean; serving?: boolean; finished?: boolean; onDetail: () => void; children?: React.ReactNode }) {
  return (
    <article className={`nd-ticket-card${serving ? " is-serving" : urgent ? " is-urgent" : ""}`}>
      <header>
        <strong>{ticket.code}</strong>
        <button type="button" className="nd-icon-button" aria-label={`Detalle del turno ${ticket.code}`} onClick={onDetail}>
          <Icon name="more" />
        </button>
      </header>
      <p>{customerName(ticket)}</p>
      {urgent ? (
        <small>
          <Badge color="orange">{`Espera prioritaria · ${waitOf(ticket)} min`}</Badge>
        </small>
      ) : null}
      <div className="nd-ticket-footer">
        <Badge>{ticket.createdBy.name}</Badge>
        <small>{finished ? "Atención finalizada" : `${Math.round(ticket.waitMinutes ?? waitOf(ticket))} min de espera`}</small>
      </div>
      {children}
    </article>
  );
}
