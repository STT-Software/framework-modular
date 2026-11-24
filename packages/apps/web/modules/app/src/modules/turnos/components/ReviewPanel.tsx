import { observer } from "mobx-react-lite";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { categoryLabel, type CategoryId } from "@/modules/businesses";
import { turnosStore } from "../stores/turnos.store";
import type { PrefixMode, TurnosStep } from "../types";
import { initialsOf } from "../validation";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { QueueSymbol } from "./QueueSymbol";

const PREFIX_SUMMARY: Record<PrefixMode, string> = { initial: "Inicial de cada fila", fixed: "", none: "Sin prefijo" };

/** Paso 5: lo que queda configurado, con atajos para corregir cada parte. */
export const ReviewPanel = observer(({ onEdit }: { onEdit: (step: TurnosStep) => void }) => {
  const state = turnosStore.state;
  if (!state) return null;
  const { rules } = state;
  const profile = state.catalog.profiles.find((item) => item.id === state.profile.id);
  const custom = state.queues.filter((queue) => Object.values(queue.overrides).some((value) => value !== null)).length;
  const stats: Array<[number, string]> = [
    [state.queues.length, "Filas de atención"],
    [state.operators.length, "Operadores"],
    [custom, "Filas personalizadas"],
  ];
  const summary: Array<[string, string]> = [
    ["Prefijo", rules.prefixMode === "fixed" ? (rules.fixedPrefix ?? "") : PREFIX_SUMMARY[rules.prefixMode]],
    ["Reinicio diario", rules.dailyReset ? "Sí" : "No"],
    ["Urgente desde", `${rules.urgentMinutes} min`],
    ["Ocupada desde", `${rules.busyLimit} en espera`],
    ["Llena desde", `${rules.fullLimit} en espera`],
  ];
  return (
    <section className="nt-panel-enter" aria-label="Revisión de Turnos">
      <div className="nt-review-head nt-card">
        <BrandCardDecor />
        <span className="nt-module-symbol">
          <Icon paths={ICONS.queue} />
        </span>
        <div>
          <span className="nt-eyebrow">TU NEGOCIO · TU CONFIGURACIÓN</span>
          <h2>{state.business.name}</h2>
          <p>
            {profile?.name ?? ""} · {categoryLabel(state.business.category as CategoryId, state.business.categoryOther)}
          </p>
        </div>
        <span className="nt-badge">Turnos</span>
      </div>
      <div className="nt-review-stats">
        {stats.map(([count, label]) => (
          <div key={label} className="nt-stat">
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="nt-card">
        <BrandCardDecor />
        <div className="nt-review-heading">
          <h2>Filas de atención</h2>
          <button className="nt-text-button" type="button" onClick={() => onEdit("queues")}>
            Editar filas
          </button>
        </div>
        <div>
          {state.queues.map((queue) => (
            <div key={queue.id} className="nt-review-queue">
              <QueueSymbol color={queue.color} />
              <div>
                <strong>{queue.name}</strong>
                <small>
                  {queue.mode === "auto" ? "Automático" : "Manual"} · {queue.averageMinutes} min · Urgente {queue.effective.urgentMinutes} min · Ocupada {queue.effective.busyLimit} / Llena {queue.effective.fullLimit}
                </small>
              </div>
              <code>{queue.ticketExample}</code>
            </div>
          ))}
        </div>
      </div>
      <div className="nt-review-columns">
        <div className="nt-card">
          <BrandCardDecor />
          <div className="nt-review-heading">
            <h2>Reglas generales</h2>
            <button className="nt-text-button" type="button" onClick={() => onEdit("rules")}>
              Editar reglas
            </button>
          </div>
          <dl className="nt-summary-list">
            {summary.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="nt-card">
          <BrandCardDecor />
          <div className="nt-review-heading">
            <h2>Equipo de Turnos</h2>
            <button className="nt-text-button" type="button" onClick={() => onEdit("operators")}>
              Editar equipo
            </button>
          </div>
          <div>
            {state.operators.map((operator) => (
              <div key={operator.id} className="nt-review-person">
                <span className="nt-person-avatar">{initialsOf(operator.name)}</span>
                <div>
                  <strong>{operator.name}</strong>
                  <small>
                    {operator.queueIds.length === 1 ? "1 fila asignada" : `${operator.queueIds.length} filas asignadas`} · Acceso OTP
                  </small>
                </div>
              </div>
            ))}
            {state.operators.length === 0 && <p className="nt-muted">Sin operadores por ahora. Puedes agregarlos después.</p>}
          </div>
        </div>
      </div>
      <div className="nt-info-box">
        <Icon paths={ICONS.info} />
        <p>
          <strong>Estamos preparando tu módulo.</strong>
          <span>Aquí guardamos su configuración. La atención de turnos, los llamados y la pantalla de sala se diseñarán después.</span>
        </p>
      </div>
    </section>
  );
});
