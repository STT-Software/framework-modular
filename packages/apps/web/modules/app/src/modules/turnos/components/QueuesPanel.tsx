import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";
import { turnosStore } from "../stores/turnos.store";
import type { TurnosQueue } from "../types";
import { DeleteDialog, type DeleteTarget } from "./DeleteDialog";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { QueueDialog } from "./QueueDialog";
import { QueueSymbol } from "./QueueSymbol";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function QueueCard({ queue, profileName, onEdit, onDelete }: { queue: TurnosQueue; profileName: (id: string) => string; onEdit: () => void; onDelete: () => void }) {
  const own = queue.overrides;
  const custom = Object.values(own).some((value) => value !== null);
  return (
    <article className="nt-queue-card" data-custom={custom ? "true" : undefined}>
      <QueueSymbol color={queue.color} />
      <div>
        <div className="nt-queue-name">
          <strong>{queue.name}</strong>
          <code>{queue.ticketExample}</code>
        </div>
        <div className="nt-queue-details">
          <span className={`nt-mode-badge${queue.mode === "manual" ? " is-manual" : ""}`}>{queue.mode === "auto" ? "Automático" : "Manual"}</span>
          <span>~{queue.averageMinutes} min por atención</span>
          <span>{queue.source === "custom" ? "Creada por ti" : `Sugerida · ${profileName(queue.source)}`}</span>
        </div>
        <div className="nt-queue-rules">
          <span className={own.prefix ? "is-custom" : undefined}>{own.prefix ? "Prefijo propio" : "Prefijo general"}</span>
          <span className={own.urgentMinutes !== null ? "is-custom" : undefined}>Urgente · {queue.effective.urgentMinutes} min</span>
          <span className={own.busyLimit !== null ? "is-custom" : undefined}>Ocupada · {queue.effective.busyLimit}</span>
          <span className={own.fullLimit !== null ? "is-custom" : undefined}>Llena · {queue.effective.fullLimit}</span>
        </div>
      </div>
      <div className="nt-card-actions">
        <button type="button" className="nt-icon-button" aria-label={`Editar fila ${queue.name}`} onClick={onEdit}>
          <Icon paths={ICONS.edit} />
        </button>
        <button type="button" className="nt-icon-button" aria-label={`Eliminar fila ${queue.name}`} onClick={onDelete}>
          <Icon paths={ICONS.trash} />
        </button>
      </div>
    </article>
  );
}

/** Paso 2: las filas de atención. Cada cambio se guarda en el servidor al confirmar su diálogo. */
export const QueuesPanel = observer(() => {
  const store = turnosStore;
  const state = store.state;
  const [editing, setEditing] = useState<{ queue: TurnosQueue | null } | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const emptyButton = useRef<HTMLButtonElement>(null);
  if (!state) return null;
  const profileName = (id: string) => state.catalog.profiles.find((profile) => profile.id === id)?.name ?? id;
  const count = state.queues.length;
  return (
    <section className="nt-panel-enter" aria-label="Filas de atención">
      <div className="nt-section-toolbar">
        <div>
          <span className="nt-badge">{profileName(state.profile.id)}</span>
          <span className="nt-muted">{plural(count, "fila", "filas")}</span>
        </div>
        <button type="button" className="nt-primary" onClick={() => setEditing({ queue: null })}>
          <span aria-hidden="true">+</span>Nueva fila
        </button>
      </div>
      <div className="nt-queue-list">
        {state.queues.map((queue) => (
          <QueueCard key={queue.id} queue={queue} profileName={profileName} onEdit={() => setEditing({ queue })} onDelete={() => setDeleting({ kind: "queue", id: queue.id })} />
        ))}
      </div>
      {count === 0 && (
        <div className="nt-card nt-empty">
          <div className="nt-empty-scene" aria-hidden="true">
            <span />
            <span />
            <span />
            <i>+</i>
          </div>
          <h2>Tu primera fila, a tu manera</h2>
          <p>Crea una fila para continuar a las reglas de turnos y asignar operadores.</p>
          <button ref={emptyButton} type="button" className="nt-primary" onClick={() => setEditing({ queue: null })}>
            Crear primera fila
          </button>
        </div>
      )}
      <p className="nt-help-note">Cada fila puede tener un modo de atención y reglas propias. Los campos sin personalizar usan las reglas generales de Turnos.</p>
      <QueueDialog target={editing} onClose={() => setEditing(null)} />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
});
