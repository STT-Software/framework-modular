import { observer } from "mobx-react-lite";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { categoryLabel } from "@/modules/businesses";
import { initialsOf } from "../initials";
import { dayText } from "../schedule";
import { businessSetupStore } from "../stores/businessSetup.store";
import { WEEK_DAYS } from "../types";
import { ModuleIcon } from "./ModuleIcon";

const dash = (value: string) => value.trim();

/** Paso 4: lo que quedará como base del negocio, con atajos para corregir cada parte. */
export const ReviewPanel = observer(({ onEdit, onViewModule }: { onEdit: (step: "data" | "schedule") => void; onViewModule: (moduleId: string) => void }) => {
  const store = businessSetupStore;
  const state = store.state;
  const base = store.baseDraft;
  if (!state || !base) return null;
  const f = store.form;
  const name = dash(f.name) || state.profile.name;
  const category = store.categoryDraft ? categoryLabel(store.categoryDraft, store.categoryDraft === "other" ? store.categoryOther.trim() : null) : "";
  const data: Array<[string, string]> = [
    ["Teléfono", dash(f.phone)],
    ["Correo", dash(f.supportEmail)],
    ["Dirección", dash(f.address)],
    ["Razón social", dash(f.legalName)],
    ["NIT / ID fiscal", dash(f.taxId)],
    ["Sitio web", dash(f.website)],
    ["Moneda", state.business.currency],
  ];
  return (
    <section className="no-panel no-panel-enter" aria-label="Revisión de la configuración base">
      <div className="no-card no-review-identity">
        <BrandCardDecor />
        <div className="no-review-logo">
          {store.logoUrl ? <img src={store.logoUrl} alt="Logo del negocio" /> : <span>{initialsOf(name)}</span>}
        </div>
        <div>
          <div className="no-review-name-row">
            <h2>{name}</h2>
            <span className="no-source-badge">{category}</span>
          </div>
          <p>{dash(f.description) || "La identidad de tu negocio, lista para conectar."}</p>
        </div>
        <button type="button" className="no-text-button" onClick={() => onEdit("data")}>
          Editar <span aria-hidden="true">↗</span>
        </button>
        <dl className="no-review-data">
          {data.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value ? undefined : "is-empty"}>{value || "Sin registrar"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="no-card no-review-hours">
        <header className="no-card-header">
          <div>
            <h2>Horario del negocio</h2>
            <p>Zona horaria: {state.schedule.timezone.replaceAll("_", " ")}</p>
          </div>
          <button type="button" className="no-text-button" onClick={() => onEdit("schedule")}>
            Editar <span aria-hidden="true">↗</span>
          </button>
        </header>
        <div className="no-review-week">
          {WEEK_DAYS.map(([day, label]) => (
            <div key={day}>
              <strong>{label}</strong>
              <span>{dayText(base[day])}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="no-card no-review-modules">
        <header className="no-card-header">
          <div>
            <h2>Módulos y horarios</h2>
            <p>Solo los módulos asignados a este negocio.</p>
          </div>
          <span className="no-hours-tag">
            {state.modules.length} {state.modules.length === 1 ? "asignado" : "asignados"}
          </span>
        </header>
        <div>
          {state.modules.map((module) => {
            const inherits = store.moduleDrafts[module.id]?.inherit ?? true;
            return (
              <div key={module.id} className="no-review-module">
                <ModuleIcon id={module.id} />
                <div>
                  <strong>{module.name}</strong>
                  <p>{inherits ? "Hereda el horario del negocio" : "Horario personalizado"} · Ajustes específicos pendientes</p>
                </div>
                <button type="button" className="no-text-button" aria-label={`Ver horario de ${module.name}`} onClick={() => onViewModule(module.id)}>
                  Ver horario ↗
                </button>
              </div>
            );
          })}
          {state.modules.length === 0 && <p className="no-field-note">Este negocio aún no tiene módulos asignados.</p>}
        </div>
      </div>
      <div className="no-pending-note">
        <span aria-hidden="true">02</span>
        <div>
          <strong>Lo que sigue: configurar cada módulo</strong>
          <p>Esta revisión prepara la base. Las reglas, servicios y equipos de cada funcionalidad se añadirán después.</p>
        </div>
      </div>
    </section>
  );
});
