import { Button } from "@/elements/ui/button";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, type FormEvent } from "react";
import { initialsOf } from "../initials";
import { businessSetupStore } from "../stores/businessSetup.store";
import { SETUP_STEPS, type SetupStep } from "../types";
import { categoryLabel } from "@/modules/businesses";
import { CategoryPanel } from "./CategoryPanel";
import { DataPanel } from "./DataPanel";
import { ReviewPanel } from "./ReviewPanel";
import { SchedulePanel } from "./SchedulePanel";
import { SetupGuide } from "./SetupGuide";

const STEP_COPY: Record<SetupStep, { nav: string; hint: string; title: string; description: string; document: string }> = {
  data: {
    nav: "Datos del negocio",
    hint: "Identificación y contacto",
    title: "Datos del negocio",
    description: "Tus datos ya están aquí. Revísalos y completa lo que haga falta.",
    document: "Datos del negocio",
  },
  schedule: {
    nav: "Horarios",
    hint: "Cuándo estás disponible",
    title: "Horarios de atención",
    description: "Define el horario del negocio y las excepciones que necesite cada módulo.",
    document: "Horarios",
  },
  category: {
    nav: "Tipo de negocio",
    hint: "Actividad principal",
    title: "Tipo de negocio",
    description: "Confirma el tipo de negocio que registraste desde superadministración.",
    document: "Tipo de negocio",
  },
  review: {
    nav: "Revisión",
    hint: "Resumen de ajustes",
    title: "Revisar configuración base",
    description: "Revisa la base de tu negocio antes de preparar sus módulos.",
    document: "Revisión de la base",
  },
};

interface WizardProps {
  step: SetupStep;
  onGo: (target: SetupStep | "modules") => void;
  onSubmit: () => void;
  onViewModule: (moduleId: string) => void;
  categoryPath: string;
}

/** El asistente de la base: pasos a la izquierda, el paso actual a la derecha y los botones de avance. */
export const Wizard = observer(({ step, onGo, onSubmit, onViewModule, categoryPath }: WizardProps) => {
  const store = businessSetupStore;
  const state = store.state;
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [step]);
  if (!state) return null;
  const index = SETUP_STEPS.indexOf(step);
  const visited = new Set(state.progress.visitedSteps);
  const copy = STEP_COPY[step];
  const name = store.form.name || state.profile.name;
  const category = store.categoryDraft ? categoryLabel(store.categoryDraft, store.categoryDraft === "other" ? store.categoryOther.trim() : null) : "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="no-wizard">
      <aside className="no-sidebar">
        <a
          href="#modules"
          className="no-back"
          onClick={(event) => {
            event.preventDefault();
            onGo("modules");
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Volver a módulos</span>
        </a>
        <div className="no-sidebar-business">
          <span className="no-avatar">{initialsOf(name)}</span>
          <div>
            <strong>{name}</strong>
            <span>{category}</span>
          </div>
        </div>
        <nav className="no-step-nav" aria-label="Pasos de configuración">
          {SETUP_STEPS.map((id, i) => {
            const done = i !== index && visited.has(id) && i < index;
            return (
              <button
                key={id}
                type="button"
                className={done ? "is-complete" : undefined}
                aria-current={i === index ? "step" : undefined}
                disabled={store.saving}
                onClick={() => onGo(id)}
              >
                <span>{done ? "✓" : `0${i + 1}`}</span>
                <div>
                  <strong>{STEP_COPY[id].nav}</strong>
                  <small>{STEP_COPY[id].hint}</small>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="no-stage">
        <div className="no-stage-heading">
          <span className="no-eyebrow">PASO 0{index + 1} DE 04 · CONFIGURACIÓN BASE</span>
          <h1 ref={titleRef} tabIndex={-1}>
            {copy.title}
          </h1>
          <p>{copy.description}</p>
        </div>
        <div className={step === "schedule" ? "config-step-workspace is-single-col" : "config-step-workspace"}>
          <div className="config-form-col">
            <form onSubmit={submit} noValidate>
              {step === "data" && <DataPanel categoryPath={categoryPath} onOpenCategory={() => onGo("category")} />}
              {step === "schedule" && <SchedulePanel />}
              {step === "category" && <CategoryPanel />}
              {step === "review" && <ReviewPanel onEdit={(target) => onGo(target)} onViewModule={onViewModule} />}
              {store.error && (
                <p className="no-error" role="alert">
                  {store.error}
                </p>
              )}
              <footer className="no-form-footer">
                <span>Paso {index + 1} de 4</span>
                <div>
                  <Button variant="outline" type="button" className="no-secondary" disabled={store.saving} onClick={() => onGo(index === 0 ? "modules" : SETUP_STEPS[index - 1])}>
                    {index === 0 ? "Volver a módulos" : "← Atrás"}
                  </Button>
                  <Button type="submit" className="no-primary" disabled={store.saving}>
                    {store.saving ? "Guardando…" : index === 3 ? "Guardar configuración base " : "Siguiente "}
                    {!store.saving && <span aria-hidden="true">{index === 3 ? "✓" : "→"}</span>}
                  </Button>
                </div>
              </footer>
            </form>
          </div>
          {step !== "schedule" && (
            <aside className="config-guide-col">
              <SetupGuide step={step} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
});

export const STEP_TITLES: Record<SetupStep | "modules", string> = {
  modules: "Los módulos de tu negocio",
  data: STEP_COPY.data.document,
  schedule: STEP_COPY.schedule.document,
  category: STEP_COPY.category.document,
  review: STEP_COPY.review.document,
};
