import { observer } from "mobx-react-lite";
import { NectoLogo } from "@/brand/NectoLogo";
import { turnosStore } from "../stores/turnos.store";
import type { PrefixMode } from "../types";
import { rulesFromForm, ticketFor } from "../validation";
import { Icon } from "./Icon";
import { ICONS } from "./icons";

const PREFIX_LABELS: Record<PrefixMode, string> = {
  initial: "Inicial de la fila · C-001",
  fixed: "Un prefijo para todas · T-001",
  none: "Solo números · 001",
};

/** Paso 3: las reglas generales. Cada fila las hereda campo por campo, salvo lo que fije por su cuenta. */
export const RulesPanel = observer(() => {
  const store = turnosStore;
  const state = store.state;
  const form = store.rulesForm;
  if (!state || !form) return null;
  const limits = state.catalog.limits;
  const sample = state.queues[0] ?? { name: "Tu fila", overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null } };
  const code = ticketFor(sample, rulesFromForm(form));

  return (
    <section className="nt-panel-enter" aria-label="Reglas generales de Turnos">
      <div className="nt-rules-layout">
        <form className="nt-card nt-rules-card" noValidate onSubmit={(event) => event.preventDefault()}>
          <div className="nt-card-title">
            <span className="nt-mini-icon">
              <Icon paths={ICONS.moduleSymbol} />
            </span>
            <div>
              <h2>La regla general</h2>
              <p>Se aplica a los valores que cada fila deja sin personalizar.</p>
            </div>
          </div>
          <div className="nt-field">
            <label htmlFor="nt-prefix-mode">Prefijo del número de turno</label>
            <select id="nt-prefix-mode" value={form.prefixMode} onChange={(event) => store.setRulesField("prefixMode", event.target.value as PrefixMode)}>
              {state.catalog.prefixModes.map((mode) => (
                <option key={mode} value={mode}>
                  {PREFIX_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>
          {form.prefixMode === "fixed" && (
            <div className="nt-field">
              <label htmlFor="nt-fixed-prefix">
                Prefijo general <b>*</b>
              </label>
              <input id="nt-fixed-prefix" maxLength={limits.prefix.max} placeholder="Ej. T" autoComplete="off" value={form.fixedPrefix} onChange={(event) => store.setRulesField("fixedPrefix", event.target.value)} />
            </div>
          )}
          <label className="nt-switch-row">
            <span>
              <strong>Reiniciar numeración cada día</strong>
              <small>La secuencia vuelve a comenzar al inicio de la jornada.</small>
            </span>
            <input type="checkbox" checked={form.dailyReset} onChange={(event) => store.setRulesField("dailyReset", event.target.checked)} />
            <span className="nt-switch" aria-hidden="true" />
          </label>
          <div className="nt-field">
            <label htmlFor="nt-urgent">Tiempo para marcar un turno como urgente</label>
            <div className="nt-input-unit">
              <input id="nt-urgent" type="number" min={limits.urgentMinutes.min} max={limits.urgentMinutes.max} inputMode="numeric" value={form.urgentMinutes} onChange={(event) => store.setRulesField("urgentMinutes", event.target.value)} />
              <span>min</span>
            </div>
            <small>Tiempo en espera a partir del cual se destaca el turno.</small>
          </div>
          <div className="nt-field-grid">
            <div className="nt-field">
              <label htmlFor="nt-busy">Fila ocupada desde</label>
              <div className="nt-input-unit">
                <input id="nt-busy" type="number" min={limits.busyLimit.min} max={limits.busyLimit.max} inputMode="numeric" value={form.busyLimit} onChange={(event) => store.setRulesField("busyLimit", event.target.value)} />
                <span>personas</span>
              </div>
            </div>
            <div className="nt-field">
              <label htmlFor="nt-full">Fila llena desde</label>
              <div className="nt-input-unit">
                <input id="nt-full" type="number" min={limits.fullLimit.generalMin} max={limits.fullLimit.max} inputMode="numeric" value={form.fullLimit} onChange={(event) => store.setRulesField("fullLimit", event.target.value)} />
                <span>personas</span>
              </div>
            </div>
          </div>
          <p className="nt-error" role="status" hidden={!store.rulesError}>
            {store.rulesError}
          </p>
        </form>
        <aside className="nt-rule-preview">
          <div className="nt-ticket-scene" aria-hidden="true">
            <div className="nt-ticket">
              <span>
                <NectoLogo variant="mark" width={64} height={64} />
              </span>
              <small>TU TURNO</small>
              <strong>{code}</strong>
              <span>{sample.name}</span>
              <i />
              <small>Una conexión a la vez.</small>
            </div>
            <span className="nt-ticket-orbit" />
            <span className="nt-ticket-spark">✦</span>
          </div>
          <div className="nt-preview-copy">
            <span className="nt-eyebrow">ASÍ SE VERÍA</span>
            <h2>
              Un orden claro.
              <br />
              Una mejor atención.
            </h2>
            <p>Los valores propios de cada fila se conservan. Cambiar la regla general actualiza solo los campos que la heredan.</p>
          </div>
          <div className="nt-load-legend">
            <span>
              <i />
              Disponible
            </span>
            <span>
              <i />
              Ocupada
            </span>
            <span>
              <i />
              Llena
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
});
