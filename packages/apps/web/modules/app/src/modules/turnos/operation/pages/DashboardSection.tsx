import { observer } from "mobx-react-lite";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ActivityList, AppDialog, Badge, CardHeading, Empty, Icon, InfoBox, LineChart, PageHeading, QueueDot, SectionHeading, Stat, activityText, initials, toastStore } from "@/modules/business-dashboard";
import { operationApi } from "../api/operationApi";
import { useRemote } from "../hooks/useRemote";
import { minutes } from "../format";
import { operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
import type { BoardEntry, TeamMember } from "../types";
export const base = (businessId: string, section = "dashboard") => `/business/app/${businessId}/turnos/${section}`;
/** «Inicio»: el pulso de la atención, con los números de hoy contados de los turnos reales. */
export const DashboardSection = observer(() => {
  const store = operationStore;
  const navigate = useNavigate();
  const admin = store.isAdmin;
  const [info, setInfo] = useState<BoardEntry | null>(null);
  const overview = useRemote(() => store.run((token, role, businessId) => operationApi.overview(token, role, businessId, "today")), []);
  const attending = useRemote(() => store.run((token, role, businessId) => operationApi.tickets(token, role, businessId, { status: ["attending"], order: "arrival", pageSize: 1 })), [], admin && store.can("my-turns"));
  const team = useRemote(() => store.run((token, _role, businessId) => operationApi.team(token, businessId, "today")), [], admin);
  const surveys = useRemote(() => store.run((token, role, businessId) => operationApi.surveySummary(token, role, businessId, { range: "7d" })), [], store.can("surveys"));
  const activity = useRemote(() => store.run((token, role, businessId) => operationApi.activity(token, role, businessId, 5)), []);
  const data = overview.data;
  const entries = data?.queues ?? [];
  const waiting = entries.reduce((sum, entry) => sum + entry.waiting, 0);
  const current = admin ? (attending.data?.items[0] ?? null) : (data?.current ?? null);
  const volume = useMemo(() => {
    const hourly = data?.hourly ?? [];
    const first = hourly.findIndex((item) => item.created > 0);
    const from = first < 0 ? Math.max(0, new Date().getHours() - 5) : Math.min(first, Math.max(0, new Date().getHours() - 5));
    const slice = hourly.slice(from, Math.min(24, Math.max(from + 6, new Date().getHours() + 1)));
    return { values: slice.map((item) => item.created), labels: slice.map((item) => `${String(item.hour).padStart(2, "0")}:00`) };
  }, [data]);
  const exportReport = async () => {
    try {
      const blob = await store.run((token, _role, businessId) => operationApi.report(token, businessId, { range: "today" }));
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `turnos-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toastStore.announce("Reporte descargado con los turnos de hoy.");
    } catch (error) {
      toastStore.announce(operationErrorMessage(error));
    }
  };
  const rating = surveys.data?.overall.average ?? null;
  const responses = surveys.data?.overall.responses ?? 0;
  const businessId = store.businessId;
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title={admin ? "Cada turno, una buena conexión." : "Tu jornada de atención."}
        description={admin ? "Sigue el ritmo de tus filas y acompaña a tu equipo." : "Este resumen corresponde únicamente a tus filas asignadas."}
        actions={
          <>
            {admin ? (
              <>
                <button type="button" className="nd-secondary" onClick={() => void exportReport()}>
                  Exportar reporte
                </button>
                <button type="button" className="nd-secondary" onClick={() => navigate(base(businessId, "display"))}>
                  Pantalla de sala
                </button>
              </>
            ) : null}
            {store.can("create-turn") ? (
              <button type="button" className="nd-primary" onClick={() => navigate(base(businessId, "create"))}>
                Crear turno
              </button>
            ) : null}
          </>
        }
      />
      <div id="nd-content">
        {overview.error ? <InfoBox title="No pudimos cargar el resumen">{overview.error}</InfoBox> : null}
        <div className="nd-control-top">
          <section className="nd-now-card">
            <div className="nd-now-copy">
              <span className="nd-eyebrow">ATENDIENDO AHORA</span>
              <h2>{current ? current.code : "Todo en orden"}</h2>
              <p>{current ? `${current.queue.name} · ${current.customer.name ?? "Sin nombre"}` : "No hay turnos en atención en este momento."}</p>
              <div style={{ marginTop: 15 }}>
                <Badge color="purple">{`${store.queues.length} filas disponibles`}</Badge>
              </div>
            </div>
            <div className="nd-now-ticket" aria-hidden="true">
              <Icon name="tickets" />
              <strong>{current ? current.code : "Necto"}</strong>
              <small>Una conexión a la vez.</small>
            </div>
          </section>
          <div className="nd-control-stats">
            <Stat label="En espera" value={waiting} icon="users" />
            <Stat label="Espera promedio" value={minutes(data?.totals.averageWaitMinutes ?? null)} unit={data?.totals.averageWaitMinutes != null ? "min" : ""} icon="clock" />
            <Stat label="Emitidos hoy" value={data?.totals.created ?? 0} icon="tickets" />
            <Stat label="Satisfacción" value={rating === null ? "—" : rating.toFixed(1)} unit={responses > 0 ? "/ 5" : ""} icon="star" foot={store.can("surveys") ? "Últimos 7 días" : "Disponible con la vista de Encuestas"} />
          </div>
        </div>
        <SectionHeading
          title="El pulso de tus filas"
          description={admin ? "Todas las filas de este negocio." : "Solo las filas que puedes atender."}
          right={
            store.can("queues") ? (
              <button type="button" className="nd-text-button" onClick={() => navigate(base(businessId, "queues"))}>
                Ver filas
              </button>
            ) : undefined
          }
        />
        {entries.length > 0 ? (
          <div className="nd-queue-status-strip">
            {entries.map((entry) => (
              <button key={entry.queue.id} type="button" className="nd-queue-status" onClick={() => (store.can("queues") ? navigate(base(businessId, `board/${entry.queue.id}`)) : setInfo(entry))}>
                <QueueDot color={entry.queue.color} />
                <div>
                  <strong>{entry.queue.name}</strong>
                  <p>{entry.queue.status === "paused" ? "En pausa" : entry.queue.mode === "auto" ? "Atención automática" : "Atención manual"}</p>
                </div>
                <b>{entry.waiting}</b>
              </button>
            ))}
          </div>
        ) : data ? (
          <Empty
            title="Todavía no hay filas"
            text="Configura las primeras filas de atención para comenzar."
            action={
              admin ? (
                <button type="button" className="nd-primary" onClick={() => navigate(`/business/turnos/${businessId}/queues`)}>
                  Configurar Turnos
                </button>
              ) : undefined
            }
          />
        ) : null}
        <div className="nd-chart-grid">
          <section className="nd-card nd-pad">
            <CardHeading title="Volumen de turnos" description="Emitidos por hora durante la jornada de hoy" />
            <LineChart values={volume.values.length > 1 ? volume.values : [0, ...volume.values, 0]} labels={volume.values.length > 1 ? volume.labels : ["", ...volume.labels, ""]} title="Turnos emitidos por hora" />
          </section>
          <section className="nd-card nd-pad">
            <CardHeading title="Espera por fila" description="Personas que todavía no han sido atendidas" />
            <div className="nd-queue-mini-list">
              {entries.length === 0 ? <p className="nd-muted">Sin filas asignadas.</p> : null}
              {entries.map((entry) => {
                const info = store.queueById(entry.queue.id);
                const full = info?.effective.fullLimit ?? 8;
                return (
                  <div key={entry.queue.id} className="nd-queue-mini">
                    <QueueDot color={entry.queue.color} />
                    <div>
                      <strong>{entry.queue.name}</strong>
                      <div className="nd-progress-track" style={{ ["--queue-color" as string]: undefined }}>
                        <span style={{ width: `${Math.min(100, (entry.waiting / full) * 100)}%` }} />
                      </div>
                      <small>{entry.longestWaitMinutes !== null ? `La espera más larga: ${Math.round(entry.longestWaitMinutes)} min` : "Nadie esperando"}</small>
                    </div>
                    <b>{entry.waiting}</b>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <div className="nd-two-columns">
          <section className="nd-card">
            {admin ? (
              <>
                <div className="nd-pad" style={{ paddingBottom: 0 }}>
                  <CardHeading
                    title="El equipo, conectado"
                    description="Atenciones y turnos completados hoy"
                    right={
                      <button type="button" className="nd-text-button" onClick={() => navigate(base(businessId, "team"))}>
                        Ver equipo
                      </button>
                    }
                  />
                </div>
                <TeamTable members={team.data ?? []} />
              </>
            ) : (
              <div className="nd-pad">
                <CardHeading title="Tu actividad" description="Últimos movimientos de tus filas" />
                <ActivityList items={(activity.data ?? []).map((entry) => ({ text: activityText(entry.type, entry.ticket.code, entry.queue.name, entry.automatic), at: entry.at }))} />
              </div>
            )}
          </section>
          <section className="nd-card nd-pad">
            <CardHeading title={admin ? "Actividad reciente" : "Una atención más clara"} description="Cada movimiento se refleja en tus filas" />
            {admin ? (
              <ActivityList items={(activity.data ?? []).map((entry) => ({ text: activityText(entry.type, entry.ticket.code, entry.queue.name, entry.automatic), at: entry.at }))} />
            ) : (
              <InfoBox title="Tu espacio de trabajo">Puedes consultar y atender únicamente las filas que te asignó el administrador.</InfoBox>
            )}
          </section>
        </div>
      </div>
      <AppDialog open={info !== null} title={info?.queue.name ?? ""} eyebrow="TURNOS · FILA" onClose={() => setInfo(null)}>
        <InfoBox>Tienes acceso al resumen de esta fila. La vista de gestión de filas no está habilitada en tu perfil.</InfoBox>
      </AppDialog>
    </>
  );
});
export function TeamTable({ members }: { members: TeamMember[] }) {
  return (
    <div className="nd-table-wrap">
      <table className="nd-table">
        <thead>
          <tr>
            <th scope="col">OPERADOR</th>
            <th scope="col">EN ATENCIÓN</th>
            <th scope="col">COMPLETADOS</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.operatorId}>
              <td>
                <div className="nd-person-cell">
                  <span className="nd-avatar">{initials(member.name)}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.status === "pending" ? "Pendiente de su primer ingreso" : member.status === "inactive" ? "Acceso desactivado" : member.operatorId.startsWith("admin:") ? "Administrador" : `${member.queueIds.length} filas asignadas`}</small>
                  </div>
                </div>
              </td>
              <td>
                <Badge color="purple">{member.current ? "1" : "0"}</Badge>
              </td>
              <td>
                <Badge color="green">{String(member.completed)}</Badge>
              </td>
            </tr>
          ))}
          {members.length === 0 ? (
            <tr>
              <td colSpan={3}>
                <p className="nd-muted nd-pad">Todavía no hay operadores.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
