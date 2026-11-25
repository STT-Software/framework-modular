import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { AppDialog, Badge, Field, Icon, InfoBox, PageHeading, QueueDot, Toggle, initials, toastStore } from "@/modules/business-dashboard";
import { TurnosError, turnosApi, type OperatorBody } from "../../api/turnosApi";
import { firstIssue, turnosErrorMessage } from "../../messages";
import type { OperatorViewId, OperatorStatus, TurnosOperator } from "../../types";
import { operationStore } from "../stores/operation.store";
import { VIEW_LABEL } from "../types";
const STATUS_TEXT: Record<OperatorStatus, string> = { pending: "Pendiente", active: "Activo", inactive: "Inactivo" };
const STATUS_COLOR: Record<OperatorStatus, "amber" | "green" | ""> = { pending: "amber", active: "green", inactive: "" };
/** Lo que el servidor guarda de un operador, para reenviarlo entero cuando solo cambia una parte. */
const bodyOf = (person: TurnosOperator, patch: Partial<OperatorBody> = {}): OperatorBody => ({
  name: person.name,
  email: person.email,
  phone: person.phone,
  queueIds: person.queueIds,
  views: person.views,
  ...(person.status === "pending" ? {} : { status: person.status }),
  ...patch,
});
/** «Operadores»: el equipo de Turnos, sus filas, las vistas que puede usar cada uno y su estado. Solo el administrador. */
export const TeamSection = observer(() => {
  const store = operationStore;
  const config = store.config;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [permissionsId, setPermissionsId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [accessId, setAccessId] = useState<string | null>(null);
  if (!config) return null;
  const people = config.operators.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(search.toLowerCase()));
  const pending = config.operators.filter((person) => person.status === "pending").length;
  const change = async (person: TurnosOperator, status: "active" | "inactive") => {
    try {
      store.applyConfig(await store.run((token) => turnosApi.updateOperator(token, store.businessId, person.id, bodyOf(person, { status }))));
      store.bump();
      toastStore.announce(status === "active" ? "Acceso activado." : "Acceso desactivado: si estaba atendiendo, su turno vuelve a la fila.");
    } catch (error) {
      toastStore.announce(turnosErrorMessage(error));
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="TURNOS · TU OPERACIÓN"
        title="El equipo detrás de cada conexión."
        description="Gestiona sus filas, sus accesos y las vistas que puede usar cada operador."
        actions={
          <button type="button" className="nd-primary" disabled={config.queues.length === 0} onClick={() => setEditing({ id: null })}>
            Añadir operador
          </button>
        }
      />
      <div id="nd-content">
        <div className="nd-filter-bar">
          <div className="nd-input-search">
            <Icon name="search" />
            <input type="search" aria-label="Buscar operador" placeholder="Buscar por nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Badge color={pending ? "amber" : "green"}>{`${pending} pendientes`}</Badge>
        </div>
        <section className="nd-card">
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead>
                <tr>
                  <th scope="col">OPERADOR</th>
                  <th scope="col">FILAS ASIGNADAS</th>
                  <th scope="col">VISTAS</th>
                  <th scope="col">ESTADO</th>
                  <th scope="col">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <button type="button" className="nd-row-click" onClick={() => setPermissionsId(person.id)}>
                        <div className="nd-person-cell">
                          <span className="nd-avatar">{initials(person.name)}</span>
                          <div>
                            <strong>{person.name}</strong>
                            <small>{person.email}</small>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td>
                      <div className="nd-permission-summary">
                        {person.queueIds.map((id) => (
                          <Badge key={id}>{config.queues.find((queue) => queue.id === id)?.name ?? "Fila no disponible"}</Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button type="button" className="nd-text-button" onClick={() => setPermissionsId(person.id)}>
                        {`${person.views.length} de 5 vistas`}
                      </button>
                    </td>
                    <td>
                      <Badge color={STATUS_COLOR[person.status]}>{STATUS_TEXT[person.status]}</Badge>
                    </td>
                    <td>
                      <div className="nd-row-actions">
                        {person.status === "pending" ? (
                          <button type="button" className="nd-secondary" onClick={() => setAccessId(person.id)}>
                            Ver acceso
                          </button>
                        ) : null}
                        <button type="button" className="nd-secondary" onClick={() => void change(person, person.status === "active" ? "inactive" : "active")}>
                          {person.status === "pending" ? "Activar" : person.status === "inactive" ? "Activar" : "Desactivar"}
                        </button>
                        <button type="button" className="nd-icon-button" aria-label={`Editar operador ${person.name}`} onClick={() => setEditing({ id: person.id })}>
                          <Icon name="edit" />
                        </button>
                        <button type="button" className="nd-icon-button" aria-label={`Quitar operador ${person.name}`} onClick={() => setDeleteId(person.id)}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {people.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="nd-empty inline">
                        <h2>No hay operadores para mostrar</h2>
                        <p>Agrega a tu equipo o cambia la búsqueda.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <InfoBox title="Un acceso a su medida">Un operador necesita al menos una fila. Las vistas se conceden solo dentro de Turnos; nunca habilitan el dashboard general del administrador. Un operador pendiente pasa a activo cuando inicia sesión por primera vez con su código.</InfoBox>
      </div>
      {editing ? <OperatorEditor id={editing.id} onClose={() => setEditing(null)} onCreated={(id) => setAccessId(id)} /> : null}
      {permissionsId ? <PermissionsDialog id={permissionsId} onClose={() => setPermissionsId(null)} /> : null}
      {deleteId ? <DeleteOperatorDialog id={deleteId} onClose={() => setDeleteId(null)} /> : null}
      <AccessInfo id={accessId} onClose={() => setAccessId(null)} />
    </>
  );
});
function QueueChecks({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const config = operationStore.config;
  if (!config) return null;
  return (
    <div className="nd-check-list">
      {config.queues.map((queue) => (
        <label key={queue.id}>
          <input type="checkbox" checked={selected.includes(queue.id)} onChange={(event) => onChange(event.target.checked ? [...selected, queue.id] : selected.filter((id) => id !== queue.id))} />
          <QueueDot color={queue.color} />
          {queue.name}
        </label>
      ))}
    </div>
  );
}
const asMessage = (error: unknown) => (error instanceof TurnosError && Object.keys(error.fields).length > 0 ? (firstIssue(error.fields) ?? turnosErrorMessage(error)) : turnosErrorMessage(error));
const DEFAULT_VIEWS: OperatorViewId[] = ["my-turns", "create-turn", "queues"];
function OperatorEditor({ id, onClose, onCreated }: { id: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const store = operationStore;
  const person = id ? store.config?.operators.find((item) => item.id === id) : undefined;
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [queueIds, setQueueIds] = useState<string[]>(person?.queueIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (name.trim().length < 2) return setError("Escribe un nombre de al menos 2 caracteres.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Escribe un correo válido para su acceso con código.");
    if (phone.trim() && phone.replace(/\D/g, "").length < 7) return setError("Revisa el número de teléfono.");
    if (queueIds.length === 0) return setError("Asigna al menos una fila al operador.");
    setBusy(true);
    try {
      const body: OperatorBody = person
        ? bodyOf(person, { name: name.trim(), email: email.trim(), phone: phone.trim() || null, queueIds })
        : { name: name.trim(), email: email.trim(), phone: phone.trim() || null, queueIds, views: DEFAULT_VIEWS };
      const state = await store.run((token) => (person ? turnosApi.updateOperator(token, store.businessId, person.id, body) : turnosApi.createOperator(token, store.businessId, body)));
      store.applyConfig(state);
      store.bump();
      onClose();
      if (person) toastStore.announce("Operador actualizado.");
      else if (state.created) onCreated(state.created.id);
    } catch (reason) {
      setError(asMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog open title={person ? "Editar operador" : "Añadir operador"} eyebrow="EQUIPO · TURNOS" submitLabel={person ? "Guardar operador" : "Agregar y ver acceso"} busy={busy} error={error} onClose={onClose} onSubmit={save}>
      <Field id="nd-op-name" label="Nombre" required>
        <input id="nd-op-name" maxLength={80} autoComplete="name" placeholder="Ej. Laura Gómez" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field id="nd-op-email" label="Correo para su acceso con código" required>
        <input id="nd-op-email" type="email" maxLength={160} autoComplete="email" placeholder="nombre@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field id="nd-op-phone" label={<>Teléfono <small>Opcional</small></>}>
        <input id="nd-op-phone" type="tel" maxLength={25} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <div className="nd-form-heading">
        Filas que puede atender <b style={{ color: "var(--nd-orange)" }}>*</b>
      </div>
      <QueueChecks selected={queueIds} onChange={setQueueIds} />
      <InfoBox title="Acceso exclusivo de Turnos">Al crearlo tendrá Mis turnos, Crear turno y Filas. Después puedes ajustar sus vistas desde su ficha.</InfoBox>
    </AppDialog>
  );
}
function PermissionsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const store = operationStore;
  const config = store.config;
  const person = config?.operators.find((item) => item.id === id);
  const [queueIds, setQueueIds] = useState<string[]>(person?.queueIds ?? []);
  const [views, setViews] = useState<OperatorViewId[]>(person?.views ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!person) onClose();
  }, [person, onClose]);
  if (!config || !person) return null;
  const save = async () => {
    if (queueIds.length === 0) return setError("El operador necesita al menos una fila asignada.");
    setBusy(true);
    try {
      store.applyConfig(await store.run((token) => turnosApi.updateOperator(token, store.businessId, person.id, bodyOf(person, { queueIds, views }))));
      store.bump();
      toastStore.announce("Permisos guardados. Se aplican a su sesión en este momento.");
      onClose();
    } catch (reason) {
      setError(asMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog open title={person.name} eyebrow="EQUIPO · ACCESO A TURNOS" submitLabel="Guardar permisos" busy={busy} error={error} onClose={onClose} onSubmit={save}>
      <div className="nd-detail-person">
        <span className="nd-avatar">{initials(person.name)}</span>
        <div>
          <h3>{person.name}</h3>
          <Badge color={STATUS_COLOR[person.status]}>{STATUS_TEXT[person.status]}</Badge>
        </div>
      </div>
      <dl className="nd-operator-contact">
        <div>
          <dt>CORREO ELECTRÓNICO</dt>
          <dd>{person.email}</dd>
        </div>
        <div>
          <dt>TELÉFONO</dt>
          <dd>{person.phone ?? "Sin registrar"}</dd>
        </div>
      </dl>
      <div className="nd-form-heading">
        Filas que puede manejar <b style={{ color: "var(--nd-orange)" }}>*</b>
      </div>
      <QueueChecks selected={queueIds} onChange={setQueueIds} />
      <div className="nd-section-heading" style={{ marginTop: 26 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500 }}>¿Qué puede ver en Turnos?</h3>
          <p>{`${views.length} de 5 vistas activas`}</p>
        </div>
        <button type="button" className="nd-text-button" onClick={() => setViews([])}>
          Ninguna
        </button>
      </div>
      <div className="nd-permission-list">
        {config.catalog.operatorViews.map((view) => (
          <div key={view} className="nd-permission-item">
            <div>
              <strong>{VIEW_LABEL[view].label}</strong>
              <small>{VIEW_LABEL[view].description}</small>
            </div>
            <Toggle checked={views.includes(view)} label={`Permitir ${VIEW_LABEL[view].label}`} onChange={(value) => setViews(config.catalog.operatorViews.filter((candidate) => (candidate === view ? value : views.includes(candidate))))} />
          </div>
        ))}
      </div>
      <InfoBox>Estas vistas no habilitan el dashboard del administrador ni la gestión de operadores. Sin ninguna vista, la persona no puede entrar a Turnos.</InfoBox>
    </AppDialog>
  );
}
function DeleteOperatorDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const store = operationStore;
  const person = store.config?.operators.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!person) return null;
  const remove = async () => {
    setBusy(true);
    try {
      store.applyConfig(await store.run((token) => turnosApi.deleteOperator(token, store.businessId, person.id)));
      store.bump();
      toastStore.announce("Asignación a Turnos retirada.");
      onClose();
    } catch (reason) {
      setError(asMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppDialog open title={`Quitar a ${person.name}`} submitLabel="Quitar de Turnos" danger busy={busy} error={error} onClose={onClose} onSubmit={remove}>
      <InfoBox>Se retirará únicamente su asignación a Turnos de este negocio. Las filas, la identidad del usuario y sus otros accesos no se eliminan. Si estaba atendiendo un turno, vuelve a la fila.</InfoBox>
    </AppDialog>
  );
}
/** Cómo entra un operador: con su correo y el código real que le llega al pedirlo. Aquí no se muestra ningún código. */
function AccessInfo({ id, onClose }: { id: string | null; onClose: () => void }) {
  const person = id ? operationStore.config?.operators.find((item) => item.id === id) : undefined;
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/business/access`;
  return (
    <AppDialog open={Boolean(person)} title="Un correo. Un código. Su espacio." eyebrow="ACCESO CON CÓDIGO · OPERADOR" onClose={onClose}>
      {person ? (
        <>
          <div className="nd-detail-person">
            <span className="nd-avatar">{initials(person.name)}</span>
            <div>
              <h3>{person.name}</h3>
              <p>{person.email}</p>
            </div>
          </div>
          <p className="nd-muted">El operador entra con el mismo acceso del administrador: escribe su correo y recibe un código real en su bandeja. Después del código entra directo a las vistas de Turnos que tiene permitidas.</p>
          <div className="nd-field" style={{ marginTop: 16 }}>
            <label htmlFor="nd-access-link">Enlace de acceso para compartir</label>
            <input id="nd-access-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
          </div>
          <button
            type="button"
            className="nd-secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                },
                () => setCopied(false),
              );
            }}
          >
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <InfoBox>{`${person.views.length} vistas permitidas · ${person.queueIds.length} filas asignadas. No enviamos el correo de invitación: compártele el enlace.`}</InfoBox>
        </>
      ) : null}
    </AppDialog>
  );
}
