import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AppDialog, Badge, Empty, Icon, PageHeading, QueueDot, Toggle } from "@/modules/business-dashboard";
import { operationApi } from "../api/operationApi";
import { DeleteQueueDialog } from "../components/DeleteQueueDialog";
import { QueueEditor } from "../components/QueueEditor";
import { useAct } from "../hooks/useAct";
import { useRemote } from "../hooks/useRemote";
import { operationStore, type QueueInfo } from "../stores/operation.store";
import type { BoardEntry, Ticket } from "../types";
import { base } from "./DashboardSection";
export const healthOf = (entry: BoardEntry | undefined): { text: string; tone: string } => {
  if (!entry) return { text: "Fluyendo bien", tone: "" };
  if (entry.state === "paused") return { text: "En pausa", tone: "paused" };
  if (entry.state === "full") return { text: "Fila llena", tone: "red" };
  if (entry.state === "busy") return { text: "Fila ocupada", tone: "amber" };
  return { text: "Fluyendo bien", tone: "" };
};
/** «Filas»: el estado de cada fila de la persona, con sus reglas y quién la atiende. El administrador también las crea y edita. */
export const QueuesSection = observer(() => {
  const store = operationStore;
  const navigate = useNavigate();
  const { act } = useAct();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [menu, setMenu] = useState<QueueInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const board = useRemote(() => store.run((token, role, businessId) => operationApi.board(token, role, businessId)), []);
  const attending = useRemote(() => store.run((token, role, businessId) => operationApi.tickets(token, role, businessId, { status: ["attending"], pageSize: 100 })), [], store.can("my-turns"));
  const entries = new Map((board.data ?? []).map((entry) => [entry.queue.id, entry]));
  const serving = new Map<string, Ticket>((attending.data?.items ?? []).map((ticket) => [ticket.queue.id, ticket]));
  const queues = store.queues.filter((queue) => queue.name.toLowerCase().includes(search.toLowerCase()));
  const toggle = (queue: QueueInfo, active: boolean) =>
    void act(
      () => store.run((token, role, businessId) => operationApi.setQueueStatus(token, role, businessId, queue.id, active ? "active" : "paused")),
      () => (active ? "La fila recibe nuevos turnos." : "Recepción pausada. Los turnos existentes se conservan."),
    ).then(() => store.readScope());
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title="Tus filas, fluyendo."
        description={store.isAdmin ? "Organiza servicios, acompaña la espera y gestiona cada atención." : "Aquí están las filas que puedes ver y atender."}
        actions={
          store.isAdmin ? (
            <button type="button" className="nd-primary" onClick={() => setEditing({ id: null })}>
              Crear fila
            </button>
          ) : undefined
        }
      />
      <div id="nd-content">
        <div className="nd-filter-bar">
          <div className="nd-input-search">
            <Icon name="search" />
            <input type="search" aria-label="Buscar filas" placeholder="Buscar una fila" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        <div className="nd-queues-grid">
          {queues.map((queue) => {
            const entry = entries.get(queue.id);
            const waiting = entry?.waiting ?? 0;
            const health = healthOf(entry);
            const current = serving.get(queue.id);
            return (
              <article key={queue.id} className="nd-card nd-queue-card">
                <div className="nd-queue-card-top">
                  <QueueDot color={queue.color} />
                  <h2>{queue.name}</h2>
                  {store.isAdmin ? (
                    <button type="button" className="nd-icon-button" aria-label={`Opciones de ${queue.name}`} onClick={() => setMenu(queue)}>
                      <Icon name="more" />
                    </button>
                  ) : null}
                </div>
                <div className={`nd-queue-health ${health.tone}`}>
                  <i />
                  {health.text}
                </div>
                <div className="nd-queue-tags">
                  <Badge color="purple">{`Prefijo ${queue.effective.prefix || "numérico"}`}</Badge>
                  <Badge color={queue.mode === "auto" ? "orange" : ""}>{queue.mode === "auto" ? "Automático" : "Manual"}</Badge>
                  <Badge color="blue">{`${queue.averageMinutes} min / atención`}</Badge>
                  <Badge color="orange">{`Urgente ≥ ${queue.effective.urgentMinutes} min`}</Badge>
                  <Badge>{`Ocupada ${queue.effective.busyLimit} / Llena ${queue.effective.fullLimit}`}</Badge>
                </div>
                <div className="nd-queue-kpis">
                  <div>
                    <span>En espera</span>
                    <strong>
                      {waiting} <small>personas</small>
                    </strong>
                  </div>
                  <div>
                    <span>Espera estimada</span>
                    <strong>{waiting ? `~${waiting * queue.averageMinutes} min` : "Sin espera"}</strong>
                    <small>Según el tiempo configurado</small>
                  </div>
                </div>
                <div className="nd-serving-line">
                  <span>Atendiendo</span>
                  <strong>{current ? `${current.code} · ${current.customer.name ?? "Sin nombre"}` : (entry?.attending ?? 0) > 0 ? "Un turno en atención" : "Nadie en atención"}</strong>
                </div>
                {store.isAdmin ? (
                  <div className="nd-queue-active-row">
                    <span>Recibir nuevos turnos</span>
                    <Toggle checked={queue.status !== "paused"} label={`Activar fila ${queue.name}`} onChange={(value) => toggle(queue, value)} />
                  </div>
                ) : null}
                <div className="nd-queue-footer">
                  <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, `board/${queue.id}`))}>
                    Gestionar fila
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {queues.length === 0 ? (
          <Empty
            title="Sin filas para mostrar"
            text="No hay filas que coincidan o todavía no tienes filas asignadas."
            action={
              store.isAdmin ? (
                <button type="button" className="nd-primary" onClick={() => setEditing({ id: null })}>
                  Crear fila
                </button>
              ) : undefined
            }
          />
        ) : null}
      </div>
      <QueueEditor open={editing !== null} queueId={editing?.id ?? null} onClose={() => setEditing(null)} />
      <AppDialog open={menu !== null} title={menu ? `Opciones de ${menu.name}` : ""} onClose={() => setMenu(null)}>
        <div className="nd-dialog-list">
          <button
            type="button"
            onClick={() => {
              setEditing({ id: menu?.id ?? null });
              setMenu(null);
            }}
          >
            <Icon name="edit" />
            Editar fila y campos
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleting(menu?.id ?? null);
              setMenu(null);
            }}
          >
            <Icon name="trash" />
            Eliminar fila
          </button>
        </div>
      </AppDialog>
      {deleting ? <DeleteQueueDialog queueId={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  );
});
