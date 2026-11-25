import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useDebounce } from "@/hooks/useDebounce";
import { AppDialog, Badge, Empty, Icon, InfoBox, PageHeading, initials } from "@/modules/business-dashboard";
import { operationApi } from "../api/operationApi";
import { customerName, statusColor, statusText, waitOf } from "../format";
import { useAct } from "../hooks/useAct";
import { useRemote } from "../hooks/useRemote";
import { operationStore } from "../stores/operation.store";
import { TICKET_STATUSES, type Ticket } from "../types";
import { base } from "./DashboardSection";
const PAGE = 20;
/** «Mis turnos»: los turnos de las filas de la persona, con búsqueda y filtros que resuelve el servidor. */
export const TicketsSection = observer(() => {
  const store = operationStore;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [queueId, setQueueId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const term = useDebounce(search.trim(), 300);
  const list = useRemote(
    () =>
      store.run((token, role, businessId) =>
        operationApi.tickets(token, role, businessId, { search: term, queueId: queueId === "all" ? undefined : queueId, status: status === "all" ? undefined : [status], page, pageSize: PAGE }),
      ),
    [term, queueId, status, page],
  );
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title="Cada turno, a la vista."
        description={store.isAdmin ? "Consulta los turnos de todas tus filas." : "Consulta los turnos de las filas que tienes asignadas."}
        actions={
          store.can("create-turn") ? (
            <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, "create"))}>
              Crear turno
            </button>
          ) : undefined
        }
      />
      <div id="nd-content">
        <div className="nd-filter-bar">
          <div className="nd-input-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Buscar turnos"
              placeholder="Buscar cliente, teléfono o número de turno"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <label className="nd-sr-only" htmlFor="nd-filter-queue">
            Fila de los turnos
          </label>
          <select
            id="nd-filter-queue"
            value={queueId}
            onChange={(event) => {
              setQueueId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas las filas</option>
            {store.queues.map((queue) => (
              <option key={queue.id} value={queue.id}>
                {queue.name}
              </option>
            ))}
          </select>
          <label className="nd-sr-only" htmlFor="nd-filter-status">
            Estado de los turnos
          </label>
          <select
            id="nd-filter-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los estados</option>
            {TICKET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusText(value)}
              </option>
            ))}
          </select>
        </div>
        {list.error ? <InfoBox title="No pudimos cargar los turnos">{list.error}</InfoBox> : null}
        <section className="nd-card">
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead>
                <tr>
                  <th scope="col">TURNO / CLIENTE</th>
                  <th scope="col">FILA</th>
                  <th scope="col">ESTADO</th>
                  <th scope="col">ESPERA</th>
                  <th scope="col">CREADO POR</th>
                  <th scope="col">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <code>{ticket.code}</code>
                      <div style={{ marginTop: 5 }}>{customerName(ticket)}</div>
                    </td>
                    <td>{ticket.queue.name}</td>
                    <td>
                      <Badge color={statusColor(ticket.status)}>{statusText(ticket.status)}</Badge>
                    </td>
                    <td>{Math.round(ticket.waitMinutes ?? waitOf(ticket))} min</td>
                    <td>{ticket.createdBy.name}</td>
                    <td>
                      <button type="button" className="nd-text-button" onClick={() => setDetailId(ticket.id)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {list.data && list.data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Empty inline title="No hay turnos con estos filtros" text="Prueba con otro nombre, fila o estado." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <div className="nd-filter-bar" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <p className="nd-muted" role="status">
            {total === 1 ? "1 turno encontrado" : `${total} turnos encontrados`}
          </p>
          {pages > 1 ? (
            <div className="nd-row-actions">
              <button type="button" className="nd-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span className="nd-muted">{`Página ${page} de ${pages}`}</span>
              <button type="button" className="nd-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <TicketDetail ticketId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
});
/** El detalle de un turno (con su historia) y, si se puede, cancelarlo. */
export const TicketDetail = observer(({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) => {
  const store = operationStore;
  const navigate = useNavigate();
  const { act, busy } = useAct();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const remote = useRemote(() => store.run((token, role, businessId) => operationApi.ticket(token, role, businessId, ticketId as string)), [ticketId], ticketId !== null);
  const ticket: Ticket | null = ticketId && remote.data?.id === ticketId ? remote.data : null;
  const close = () => {
    setConfirming(false);
    setReason("");
    onClose();
  };
  const cancel = async () => {
    if (!ticket) return;
    const done = await act(() => store.run((token, role, businessId) => operationApi.act(token, role, businessId, ticket.id, "cancel", reason.trim() || undefined)), () => "Turno cancelado.");
    if (done) close();
  };
  const canCancel = ticket !== null && (ticket.status === "waiting" || (ticket.status === "attending" && ticket.attendedBy !== null)) && store.can("my-turns");
  return (
    <AppDialog
      open={ticketId !== null}
      title={ticket?.code ?? "Turno"}
      eyebrow="TURNOS · DETALLE"
      submitLabel={confirming ? "Cancelar turno" : undefined}
      danger
      busy={busy}
      onClose={close}
      onSubmit={cancel}
      footerExtra={
        ticket ? (
          <>
            {canCancel && !confirming ? (
              <button type="button" className="nd-text-button" onClick={() => setConfirming(true)}>
                Cancelar turno
              </button>
            ) : null}
            {store.can("queues") && !confirming ? (
              <button
                type="button"
                className="nd-primary"
                onClick={() => {
                  close();
                  navigate(base(store.businessId, `board/${ticket.queue.id}`));
                }}
              >
                Ver fila
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {!ticket ? (
        <p className="nd-muted">{remote.error ?? "Cargando…"}</p>
      ) : confirming ? (
        <>
          <p className="nd-muted">El turno quedará cancelado y se conservará en el historial.</p>
          <div className="nd-field" style={{ marginTop: 16 }}>
            <label htmlFor="nd-cancel-reason">Motivo (opcional)</label>
            <textarea id="nd-cancel-reason" rows={3} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className="nd-detail-person">
            <span className="nd-avatar">{initials(customerName(ticket))}</span>
            <div>
              <h3>{customerName(ticket)}</h3>
              <p>{ticket.queue.name}</p>
            </div>
            <Badge color={statusColor(ticket.status)}>{statusText(ticket.status)}</Badge>
          </div>
          <dl className="nd-business-data">
            {[
              ["Teléfono", ticket.customer.phone ?? "Sin registrar"],
              ["Correo", ticket.customer.email ?? "Sin registrar"],
              ["Tiempo en espera", `${Math.round(ticket.waitMinutes ?? waitOf(ticket))} min`],
              ["Creado por", ticket.createdBy.name],
              ["Atendido por", ticket.attendedBy?.name ?? "Todavía nadie"],
              ...(ticket.cancelReason ? [["Motivo de la cancelación", ticket.cancelReason]] : []),
              ...ticket.answers.map((answer) => [answer.label, typeof answer.value === "boolean" ? (answer.value ? "Sí" : "No") : String(answer.value)]),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {ticket.note ? <InfoBox title="Nota">{ticket.note}</InfoBox> : null}
          {ticket.events && ticket.events.length > 0 ? (
            <>
              <div className="nd-form-heading" style={{ marginTop: 18 }}>
                Historial
              </div>
              <div className="nd-activity-list">
                {ticket.events.map((event, index) => (
                  <div key={index} className="nd-activity-item">
                    <span className="nd-activity-symbol">
                      <Icon name="activity" />
                    </span>
                    <div>
                      <strong>{EVENT_TEXT[event.type] ?? event.type}</strong>
                      <p>
                        {new Date(event.at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        {event.by.name ? ` · ${event.by.name}` : ""}
                        {event.automatic ? " · automático" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </AppDialog>
  );
});
const EVENT_TEXT: Record<string, string> = {
  created: "Turno creado",
  called: "Pasó a atención",
  completed: "Atención completada",
  cancelled: "Turno cancelado",
  "no-show": "La persona no asistió",
  released: "Volvió a la fila",
};
