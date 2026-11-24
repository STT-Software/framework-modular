import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AppDialog, Field, InfoBox, PageHeading, Toggle, toastStore } from "@/modules/business-dashboard";
import { operationApi } from "../api/operationApi";
import { useRemote } from "../hooks/useRemote";
import { operationErrorMessage } from "../messages";
import { operationStore } from "../stores/operation.store";
import type { RoomScreen } from "../types";
import { base } from "./DashboardSection";
/** «Pantalla de sala»: lo que mostraría la pantalla de la sala de espera con los ajustes guardados, y esos ajustes. Solo el administrador. */
export const DisplaySection = observer(() => {
  const store = operationStore;
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const screen = useRemote(() => store.run((token, _role, businessId) => operationApi.roomScreen(token, businessId)), []);
  const waiting = useRemote(() => store.run((token, role, businessId) => operationApi.tickets(token, role, businessId, { status: ["waiting"], order: "arrival", pageSize: 30 })), []);
  const settings = screen.data?.settings;
  const shown = settings?.queueIds ?? null;
  const current = screen.data?.calls.find((call) => call.status === "attending") ?? null;
  const next = (waiting.data?.items ?? []).filter((ticket) => shown === null || shown.includes(ticket.queue.id)).slice(0, 5);
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title="Una espera mejor acompañada."
        description="Vista previa de la pantalla de sala con los ajustes guardados. Los llamados salen de los turnos reales."
        actions={
          <>
            <button type="button" className="nd-secondary" onClick={() => setSettingsOpen(true)}>
              Configurar display
            </button>
            <button type="button" className="nd-primary" onClick={() => navigate(base(store.businessId, "dashboard"))}>
              Volver a Turnos
            </button>
          </>
        }
      />
      <div id="nd-content">
        {screen.error ? <InfoBox title="No pudimos cargar la pantalla">{screen.error}</InfoBox> : null}
        {settings && !settings.enabled ? <InfoBox title="La pantalla de sala está apagada">Guarda los ajustes con «Pantalla habilitada» para empezar a usarla.</InfoBox> : null}
        <section className="nd-display">
          <header className="nd-display-header">
            <h2>{store.businessName}</h2>
            <span>Tu turno está cada vez más cerca.</span>
          </header>
          <div className="nd-display-grid">
            <div className="nd-display-current">
              <span>AHORA ES TU TURNO</span>
              <strong>{current ? current.code : "—"}</strong>
              <p>{current ? current.queueName : "En espera del próximo llamado"}</p>
              {current?.customer ? <p>{current.customer}</p> : null}
            </div>
            <div className="nd-display-next">
              <h3>Próximas conexiones</h3>
              {next.map((ticket) => (
                <div key={ticket.id} className="nd-display-line">
                  <strong>{ticket.code}</strong>
                  <span>{ticket.queue.name}</span>
                </div>
              ))}
              {next.length === 0 ? <p className="nd-muted">No hay personas esperando.</p> : null}
            </div>
          </div>
          {settings?.message ? <footer className="nd-pad nd-muted">{settings.message}</footer> : null}
        </section>
        {screen.data && screen.data.calls.length > 1 ? (
          <section className="nd-card nd-pad" style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Últimos llamados</h2>
            <div className="nd-activity-list">
              {screen.data.calls.map((call) => (
                <div key={call.ticketId} className="nd-activity-item">
                  <div>
                    <strong>{call.code}</strong>
                    <p>{`${call.queueName}${call.customer ? ` · ${call.customer}` : ""} · ${new Date(call.calledAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {settingsOpen && settings ? <DisplaySettings current={settings} onClose={() => setSettingsOpen(false)} onSaved={screen.reload} /> : null}
    </>
  );
});
function DisplaySettings({ current, onClose, onSaved }: { current: RoomScreen["settings"]; onClose: () => void; onSaved: () => void }) {
  const store = operationStore;
  const [enabled, setEnabled] = useState(current.enabled);
  const [message, setMessage] = useState(current.message ?? "");
  const [names, setNames] = useState(current.customerName);
  const [sound, setSound] = useState(current.playSound);
  const [recent, setRecent] = useState(String(current.recentCalls));
  const [queueIds, setQueueIds] = useState<string[]>(current.queueIds ?? store.queues.map((queue) => queue.id));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const count = Number(recent);
    if (!Number.isInteger(count) || count < 1 || count > 10) return setError("Los llamados recientes deben estar entre 1 y 10.");
    if (queueIds.length === 0) return setError("Elige al menos una fila para la pantalla.");
    setBusy(true);
    try {
      await store.run((token, _role, businessId) =>
        operationApi.saveRoomScreen(token, businessId, {
          enabled,
          queueIds: queueIds.length === store.queues.length ? null : queueIds,
          customerName: names,
          playSound: sound,
          recentCalls: count,
          message: message.trim() || null,
        }),
      );
      await store.readScope();
      toastStore.announce("Pantalla de sala actualizada.");
      onSaved();
      onClose();
    } catch (reason) {
      setError(operationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog open title="Una sala mejor conectada" submitLabel="Guardar display" busy={busy} error={error} onClose={onClose} onSubmit={save}>
      <div className="nd-permission-item">
        <div>
          <strong>Pantalla habilitada</strong>
          <small>Activa o apaga el uso de la pantalla de sala.</small>
        </div>
        <Toggle checked={enabled} label="Habilitar pantalla" onChange={setEnabled} />
      </div>
      <Field id="nd-display-message" label="Mensaje de la pantalla">
        <textarea id="nd-display-message" rows={3} maxLength={120} value={message} onChange={(event) => setMessage(event.target.value)} />
      </Field>
      <Field id="nd-display-names" label="Nombre del cliente en pantalla" hint="Por defecto solo se muestra el nombre de pila.">
        <select id="nd-display-names" value={names} onChange={(event) => setNames(event.target.value as typeof names)}>
          <option value="hidden">Solo el número del turno</option>
          <option value="first-name">Número y nombre de pila</option>
          <option value="full">Número y nombre completo</option>
        </select>
      </Field>
      <Field id="nd-display-recent" label="Llamados recientes en pantalla (1 a 10)">
        <input id="nd-display-recent" type="number" min={1} max={10} value={recent} onChange={(event) => setRecent(event.target.value)} />
      </Field>
      <div className="nd-permission-item">
        <div>
          <strong>Aviso sonoro</strong>
          <small>Guarda la preferencia de sonido al llamar.</small>
        </div>
        <Toggle checked={sound} label="Aviso sonoro" onChange={setSound} />
      </div>
      <div className="nd-form-heading" style={{ marginTop: 18 }}>
        Filas que muestra
      </div>
      <div className="nd-check-list">
        {store.queues.map((queue) => (
          <label key={queue.id}>
            <input type="checkbox" checked={queueIds.includes(queue.id)} onChange={(event) => setQueueIds(event.target.checked ? [...queueIds, queue.id] : queueIds.filter((id) => id !== queue.id))} />
            {queue.name}
          </label>
        ))}
      </div>
    </AppDialog>
  );
}
