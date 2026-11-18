import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { moduleInfo } from "@/modules/businesses";
import { dayText } from "../schedule";
import { businessSetupStore, type HoursScope } from "../stores/businessSetup.store";
import { WEEK_DAYS } from "../types";

function zoneLabel(timezone: string): string {
  return timezone.replaceAll("_", " ");
}

const WeekPreview = ({ schedule }: { schedule: NonNullable<typeof businessSetupStore.baseDraft> }) => (
  <>
    {WEEK_DAYS.map(([day, label]) => (
      <div key={day}>
        <strong>{label}</strong>
        <span>{dayText(schedule[day])}</span>
      </div>
    ))}
  </>
);

/** Paso 2: el horario del negocio y, por módulo, heredarlo o tener uno propio (la excepción). */
export const SchedulePanel = observer(() => {
  const store = businessSetupStore;
  const state = store.state;
  const tablist = useRef<HTMLDivElement>(null);
  const lastError = useRef<string>("");
  const scope = store.hoursScope;
  const schedule = store.scopeSchedule;
  const inherits = store.scopeInherits;
  const isModule = scope !== "business";
  const errorKey = store.hoursErrors.map((e) => `${e.scope}.${e.day}.${e.index}`).join("|");

  // Cuando hay un aviso nuevo, el foco va al campo de cierre con el problema.
  useEffect(() => {
    if (!errorKey || errorKey === lastError.current) return;
    lastError.current = errorKey;
    const first = store.hoursErrors.find((problem) => problem.scope === scope);
    if (first) document.getElementById(`no-time-${scope}-${first.day}-${first.index}-end`)?.focus();
  }, [errorKey, scope, store]);
  useEffect(() => {
    if (!errorKey) lastError.current = "";
  }, [errorKey]);

  if (!state || !store.baseDraft) return null;
  const scopes: Array<[HoursScope, string]> = [["business", "Negocio"], ...state.modules.map((module): [HoursScope, string] => [module.id, module.name])];
  const scopeName = scope === "business" ? "Horario del negocio" : (moduleInfo(scope)?.name ?? scope);
  const problemsOf = (day: string) => store.hoursErrors.filter((problem) => problem.scope === scope && problem.day === day);

  const moveTab = (index: number, key: string) => {
    const next = key === "Home" ? 0 : key === "End" ? scopes.length - 1 : (index + (key === "ArrowRight" ? 1 : -1) + scopes.length) % scopes.length;
    store.setHoursScope(scopes[next][0]);
    requestAnimationFrame(() => (tablist.current?.children[next] as HTMLElement | undefined)?.focus());
  };

  return (
    <section className="no-panel" aria-label="Horarios de atención">
      <div className="no-card no-hours-card">
        <header className="no-card-header">
          <div>
            <h2>Disponibilidad semanal</h2>
            <p>Zona horaria: {zoneLabel(state.schedule.timezone)}</p>
          </div>
          <span className="no-hours-tag">{scopeName}</span>
        </header>
        <div ref={tablist} className="no-schedule-tabs" role="tablist" aria-label="Horario del negocio o de un módulo">
          {scopes.map(([key, label], index) => (
            <button
              key={key}
              type="button"
              id={`no-scope-${key}`}
              role="tab"
              aria-controls="no-schedule-content"
              aria-selected={scope === key}
              tabIndex={scope === key ? 0 : -1}
              onClick={() => store.setHoursScope(key)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                moveTab(index, event.key);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div id="no-schedule-content" role="tabpanel" tabIndex={0} aria-labelledby={`no-scope-${scope}`}>
          {isModule && (
            <div className="no-inherit-panel">
              <label>
                <input type="checkbox" checked={inherits} onChange={(event) => store.setInherit(event.target.checked)} />
                <span className="no-toggle" aria-hidden="true" />
                <span>
                  <strong>Usar el horario del negocio</strong>
                  <small>Los cambios del horario base también se aplicarán a este módulo.</small>
                </span>
              </label>
            </div>
          )}
          {inherits && store.baseDraft ? (
            <div className="no-inherited-preview">
              <WeekPreview schedule={store.baseDraft} />
            </div>
          ) : (
            schedule && (
              <div>
                <div className="no-hour-shortcuts">
                  <span>Configura varios días a la vez</span>
                  <div>
                    <button type="button" onClick={() => store.applyShortcut("weekdays")}>
                      Lu–Vi · 08–18
                    </button>
                    <button type="button" onClick={() => store.applyShortcut("everyday")}>
                      Todos · 08–18
                    </button>
                    <button type="button" onClick={() => store.applyShortcut("weekend")}>
                      Cerrar fin de semana
                    </button>
                  </div>
                </div>
                <div className="no-week-days">
                  {WEEK_DAYS.map(([day, label]) => {
                    const value = schedule[day];
                    const problems = problemsOf(day);
                    return (
                      <div key={day} className={`no-day${value.open ? "" : " is-closed"}`}>
                        <div className="no-day-title">
                          <label className="no-day-toggle">
                            <input
                              type="checkbox"
                              checked={value.open}
                              aria-label={`${label} abierto`}
                              onChange={(event) => store.toggleDay(day, event.target.checked)}
                            />
                            <span className="no-toggle" aria-hidden="true" />
                            {label}
                          </label>
                          <span className="no-day-status">{value.open ? "Abierto" : "Cerrado"}</span>
                        </div>
                        {value.open ? (
                          <div>
                            <div className="no-day-ranges">
                              {value.ranges.map((range, index) => (
                                <div key={index} className="no-range">
                                  {(["start", "end"] as const).map((edge) => (
                                    <span key={edge} style={{ display: "contents" }}>
                                      {edge === "end" && <span className="no-range-dash">–</span>}
                                      <label className="no-time-control">
                                        <span>{edge === "start" ? "ABRE" : "CIERRA"}</span>
                                        <input
                                          type="time"
                                          step={60}
                                          id={`no-time-${scope}-${day}-${index}-${edge}`}
                                          value={range[edge]}
                                          aria-label={`${edge === "start" ? "Apertura" : "Cierre"} de ${label}, franja ${index + 1}`}
                                          aria-describedby={`no-day-error-${day}`}
                                          aria-invalid={problems.some((problem) => problem.index === index) && edge === "end" ? true : undefined}
                                          onChange={(event) => store.setTime(day, index, edge, event.target.value)}
                                        />
                                      </label>
                                    </span>
                                  ))}
                                  <button
                                    type="button"
                                    className="no-remove-range"
                                    aria-label={`Eliminar franja ${index + 1} de ${label}`}
                                    onClick={() => store.removeRange(day, index)}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="no-day-actions">
                              <button
                                type="button"
                                className="no-add-range"
                                aria-label={`Agregar franja para ${label}`}
                                onClick={() => {
                                  store.addRange(day);
                                  requestAnimationFrame(() =>
                                    document.getElementById(`no-time-${scope}-${day}-${store.scopeSchedule?.[day].ranges.length ? store.scopeSchedule[day].ranges.length - 1 : 0}-start`)?.focus(),
                                  );
                                }}
                              >
                                + Agregar franja
                              </button>
                              <button
                                type="button"
                                className="no-copy-day"
                                aria-label={`Copiar horario de ${label} a días abiertos`}
                                onClick={() => store.copyDayToOpenDays(day)}
                              >
                                Copiar a días abiertos
                              </button>
                            </div>
                            <p id={`no-day-error-${day}`} className="no-error" role="status" hidden={problems.length === 0}>
                              {problems[0]?.message}
                            </p>
                          </div>
                        ) : (
                          <span className="no-closed-label">Sin atención este día</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
        <p className="no-hours-note">Puedes añadir varias franjas al día y dejar cerrados los días sin atención.</p>
      </div>
    </section>
  );
});
