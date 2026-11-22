import { observer } from "mobx-react-lite";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { ArtStage, PassArt } from "@/components/configuration/GuideFigure";
import { turnosStore } from "../stores/turnos.store";
import type { PrefixMode } from "../types";
import { effectiveFor, rulesFromForm, ticketFor } from "../validation";

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
  const rules = rulesFromForm(form);
  const code = ticketFor(sample, rules);
  const effective = effectiveFor(sample, rules);
  const validThresholds = Number.isInteger(effective.busyLimit) && effective.busyLimit > 0 && Number.isInteger(effective.fullLimit) && effective.fullLimit > effective.busyLimit;

  return (
    <section className="nt-panel-enter" aria-label="Reglas generales de Turnos">
      <div className="nt-rules-layout">
        <form className="nt-card nt-rules-card" noValidate onSubmit={(event) => event.preventDefault()}>
          <BrandCardDecor />
          <fieldset className="nt-rule-group">
            <legend>Numeración de turnos</legend>
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
          </fieldset>
          <fieldset className="nt-rule-group">
            <legend>Espera y capacidad</legend>
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
          </fieldset>
          <p className="nt-error" role="status" hidden={!store.rulesError}>
            {store.rulesError}
          </p>
        </form>
        <aside className="nt-rule-preview">
          <ArtStage label={`Ejemplo de turno ${code} para ${sample.name}`}>
            <PassArt label="TU TURNO" value={code} detail={sample.name} chip={form.dailyReset ? "Reinicio diario" : "Serie continua"} icon="ticket" />
          </ArtStage>
          <div className="nt-preview-copy">
            <span className="nt-eyebrow">VISTA PREVIA</span>
            <h2>
              Así se identifica el turno
            </h2>
            <p>El tiquete muestra la numeración de «{sample.name}». Los límites de esta fila combinan las reglas generales con sus ajustes propios.</p>
          </div>
          <div className="nt-load-legend">
            <span key={`available-${effective.busyLimit}`} className="art-value-change">
              <i />
              Disponible{validThresholds && ` · Menos de ${effective.busyLimit} en espera`}
            </span>
            <span key={`busy-${effective.busyLimit}`} className="art-value-change">
              <i />
              Ocupada{validThresholds && ` · Desde ${effective.busyLimit} en espera`}
            </span>
            <span key={`full-${effective.fullLimit}`} className="art-value-change">
              <i />
              Llena{validThresholds && ` · Desde ${effective.fullLimit} en espera`}
            </span>
            {Number.isFinite(effective.urgentMinutes) && <span key={`urgent-${effective.urgentMinutes}`} className="art-value-change">Urgente desde {effective.urgentMinutes} min</span>}
          </div>
        </aside>
      </div>
    </section>
  );
});
