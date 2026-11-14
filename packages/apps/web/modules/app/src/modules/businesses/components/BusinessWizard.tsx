import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { Select } from "@/elements/form/select";
import { BusinessesError, businessesApi } from "../api/businessesApi";
import { CATEGORIES, CURRENCIES, initialsOf, MODULES, TIMEZONES } from "../catalog";
import {
  draftCategoryLabel,
  EMPTY_DRAFT,
  fromBusiness,
  IDENTITY_FIELDS,
  serverFieldErrors,
  stepOf,
  toInput,
  validateIdentity,
  type BusinessDraft,
  type DraftErrors,
  type DraftField,
} from "../draft";
import { businessErrorMessage } from "../errors";
import { businessesStore } from "../stores/businesses.store";
import type { Business, ModuleId } from "../types";
import { BossDialog } from "./BossDialog";
import { ModuleIcon } from "./ModuleIcon";
import { SummaryPanel } from "./SummaryPanel";

const STEPS = [
  { title: "Identidad", hint: "Cuéntanos de tu negocio" },
  { title: "Módulos", hint: "Elige tus herramientas" },
  { title: "Jefe de negocio", hint: "Asigna al responsable" },
] as const;

interface BusinessWizardProps {
  /** The business to edit; without it the wizard creates a new one. */
  business?: Business;
  /** The person leaves without saving. */
  onCancel: () => void;
  /** The business was saved. */
  onSaved: (business: Business) => void;
}

/**
 * The three steps to create (or edit) a business: identity, modules and boss. Everything is validated here
 * before sending, and again by the service, whose field errors are shown on the right field.
 */
export function BusinessWizard({ business, onCancel, onSaved }: BusinessWizardProps) {
  const editing = Boolean(business);
  const baseId = useId();
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BusinessDraft>(() => (business ? fromBusiness(business) : EMPTY_DRAFT));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [modulesReviewed, setModulesReviewed] = useState(editing);
  const [bossOpen, setBossOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // The same submission always carries the same key, so a double click or a retry never creates two businesses.
  // If the data changes, it is another request and gets a new key.
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const fieldId = (field: string) => `${baseId}-${field}`;

  const identityReady = draft.name.trim().length >= 2 && Boolean(draft.category) && (draft.category !== "other" || draft.categoryOther.trim().length >= 2);
  const completed = Number(identityReady) + Number(modulesReviewed) + Number(Boolean(draft.boss));
  const originalBossEmail = business?.boss.email ?? null;
  const bossReplaced = Boolean(draft.boss && originalBossEmail && draft.boss.email !== originalBossEmail);

  useEffect(() => {
    headingRefs.current[0]?.focus({ preventScroll: true });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof BusinessDraft>(field: K, value: BusinessDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function goTo(next: number, focus = true) {
    setStep(next);
    if (focus) requestAnimationFrame(() => headingRefs.current[next]?.focus({ preventScroll: true }));
  }

  function focusField(field: DraftField) {
    const id = field === "category" ? fieldId("category-0") : fieldId(field);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  /** True when the identity is valid; otherwise shows the errors and focuses the first wrong field. */
  function checkIdentity(): boolean {
    const found = validateIdentity(draft);
    setErrors(found);
    const first = IDENTITY_FIELDS.find((field) => found[field]);
    if (first) {
      if (step !== 0) goTo(0, false);
      focusField(first);
      return false;
    }
    return true;
  }

  function navigate(next: number) {
    if (next > step && !checkIdentity()) return;
    if (next > 1) setModulesReviewed(true);
    goTo(next);
  }

  function toggleModule(id: ModuleId) {
    update("modules", draft.modules.includes(id) ? draft.modules.filter((item) => item !== id) : [...draft.modules, id]);
  }

  async function save() {
    const input = toInput(draft);
    const fingerprint = JSON.stringify(input);
    if (!editing && attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const saved =
        editing && business ? await businessesApi.update(business.id, input) : await businessesApi.create(input, attempt.current!.key);
      businessesStore.invalidate();
      const name = saved.name;
      businessesStore.setNotice(
        editing
          ? `Configuración actualizada. ${name} conserva su espacio.${bossReplaced ? ` ${saved.boss.name} recibirá una invitación y el jefe anterior dejó de tener acceso.` : ""}`
          : `Todo listo. ${name} ya está en tu workspace. Estamos enviando la invitación a ${saved.boss.email}: revisa su estado en la ficha, pestaña Equipo.`,
      );
      onSaved(saved);
    } catch (failure) {
      if (failure instanceof BusinessesError && failure.kind === "validation") {
        const fromServer = serverFieldErrors(failure.fields);
        const fields = Object.keys(fromServer) as DraftField[];
        setErrors(fromServer);
        setFormError(fields.length ? "El servicio no aceptó algunos datos. Revisa los campos marcados." : businessErrorMessage(failure));
        if (fields.length) {
          const target = Math.min(...fields.map(stepOf)) as 0 | 1 | 2;
          goTo(target, false);
          if (target === 0) focusField(IDENTITY_FIELDS.find((field) => fromServer[field]) ?? "name");
        }
      } else {
        setFormError(businessErrorMessage(failure));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!checkIdentity()) return;
    if (step < 2) {
      navigate(step + 1);
      return;
    }
    if (!draft.boss) {
      setBossOpen(true);
      return;
    }
    void save();
  }

  const categoryText = draftCategoryLabel(draft);

  function textField(
    field: "name" | "legalName" | "taxId" | "phone" | "supportEmail" | "address" | "website",
    label: string,
    props: { placeholder: string; maxLength: number; type?: string; autoComplete?: string; required?: boolean; optional?: boolean; full?: boolean },
  ) {
    const error = errors[field];
    return (
      <div className={`bs-field${props.full ? " bs-full" : ""}`}>
        <Label htmlFor={fieldId(field)}>
          {label}
          {props.required && (
            <>
              {" "}
              <span className="bs-required">*</span>
            </>
          )}
          {props.optional && <span className="bs-optional">Opcional</span>}
        </Label>
        <Input
          id={fieldId(field)}
          name={field}
          type={props.type ?? "text"}
          value={draft[field]}
          onChange={(event) => update(field, event.target.value)}
          placeholder={props.placeholder}
          maxLength={props.maxLength}
          autoComplete={props.autoComplete}
          required={props.required}
          error={Boolean(error)}
          aria-describedby={error ? `${fieldId(field)}-error` : undefined}
        />
        {error && (
          <p id={`${fieldId(field)}-error`} className="bs-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bs-content">
      <div className="bs-heading">
        <button type="button" className="bs-back" onClick={onCancel}>
          <span aria-hidden="true">←</span> Mis negocios
        </button>
        <div className="bs-heading-row">
          <div>
            <span className="ws-eyebrow">UNA NUEVA CONEXIÓN</span>
            <h1 tabIndex={-1}>{editing ? "Edita tu negocio" : "Crea tu negocio"}</h1>
            <p>Un espacio propio. Las herramientas que necesitas. El equipo correcto.</p>
          </div>
          <span className="bs-draft-badge">
            <i />
            {editing ? "Editando" : "En configuración"}
          </span>
        </div>
      </div>
      <nav className="bs-steps" aria-label="Pasos para configurar el negocio">
        {STEPS.map((item, index) => {
          const done = index === 0 ? identityReady : index === 1 ? modulesReviewed : Boolean(draft.boss);
          const complete = done && index !== step;
          return (
            <button
              key={item.title}
              type="button"
              className={complete ? "is-complete" : undefined}
              aria-current={index === step ? "step" : undefined}
              onClick={() => navigate(index)}
            >
              <span className="bs-step-number">{complete ? "✓" : `0${index + 1}`}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.hint}</small>
              </span>
              {index < 2 && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}
      </nav>
      <div className="bs-layout">
        <form className="bs-form-card" onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className="bs-error-banner" role="alert" style={{ margin: "22px 26px 0" }}>
              {formError}
            </p>
          )}
          {step === 0 && (
            <section className="bs-panel bs-panel-enter" aria-labelledby={fieldId("identity-title")}>
              <div className="bs-panel-heading">
                <span className="bs-section-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 10v10h16V10M3 4h18l1 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1l1-6ZM10 20v-6h5v6" />
                  </svg>
                </span>
                <div>
                  <h2 id={fieldId("identity-title")} tabIndex={-1} ref={(node) => void (headingRefs.current[0] = node)}>
                    La identidad de tu negocio
                  </h2>
                  <p>
                    Los campos con <span className="bs-required">*</span> son obligatorios.
                  </p>
                </div>
              </div>
              <div className="bs-fields">
                {textField("name", "Nombre comercial", { placeholder: "Ej. Casa Oliva", maxLength: 120, autoComplete: "organization", required: true, full: true })}
                {textField("legalName", "Razón social", { placeholder: "Ej. Casa Oliva S.A.S.", maxLength: 150 })}
                {textField("taxId", "NIT / ID fiscal", { placeholder: "Ej. 900.123.456-7", maxLength: 40 })}
                {textField("phone", "Teléfono de contacto", { placeholder: "+57 300 123 4567", maxLength: 25, type: "tel", autoComplete: "tel" })}
                {textField("supportEmail", "Correo de asistencia", { placeholder: "hola@tunegocio.com", maxLength: 254, type: "email", autoComplete: "email" })}
                {textField("address", "Dirección", { placeholder: "Calle, número y ciudad", maxLength: 200, autoComplete: "street-address", full: true })}
                {textField("website", "Sitio web", { placeholder: "https://tunegocio.com", maxLength: 200, type: "url", autoComplete: "url", optional: true, full: true })}
                <fieldset className="bs-category bs-full" aria-describedby={errors.category ? fieldId("category-error") : undefined}>
                  <legend>
                    Categoría del negocio <span className="bs-required">*</span>
                  </legend>
                  <div className="bs-category-options">
                    {CATEGORIES.map((category, index) => (
                      <label key={category.id}>
                        <input
                          id={fieldId(`category-${index}`)}
                          type="radio"
                          name="category"
                          value={category.id}
                          checked={draft.category === category.id}
                          onChange={() => update("category", category.id)}
                        />
                        <span>{category.id === "other" ? "+ Otra" : category.name}</span>
                      </label>
                    ))}
                  </div>
                  {errors.category && (
                    <p id={fieldId("category-error")} className="bs-error">
                      {errors.category}
                    </p>
                  )}
                </fieldset>
                {draft.category === "other" && (
                  <div className="bs-field bs-full">
                    <Label htmlFor={fieldId("categoryOther")}>
                      ¿Cuál es la categoría? <span className="bs-required">*</span>
                    </Label>
                    <Input
                      id={fieldId("categoryOther")}
                      value={draft.categoryOther}
                      onChange={(event) => update("categoryOther", event.target.value)}
                      placeholder="Escribe la categoría de tu negocio"
                      maxLength={60}
                      error={Boolean(errors.categoryOther)}
                      aria-describedby={errors.categoryOther ? `${fieldId("categoryOther")}-error` : undefined}
                    />
                    {errors.categoryOther && (
                      <p id={`${fieldId("categoryOther")}-error`} className="bs-error">
                        {errors.categoryOther}
                      </p>
                    )}
                  </div>
                )}
                <div className="bs-field">
                  <Label>Moneda principal</Label>
                  <Select
                    name="currency"
                    aria-label="Moneda principal"
                    options={CURRENCIES}
                    defaultValue={draft.currency}
                    onChange={(value) => update("currency", value)}
                  />
                </div>
                <div className="bs-field">
                  <Label>Zona horaria</Label>
                  <Select
                    name="timezone"
                    aria-label="Zona horaria"
                    options={TIMEZONES}
                    defaultValue={draft.timezone}
                    onChange={(value) => update("timezone", value)}
                  />
                </div>
              </div>
            </section>
          )}
          {step === 1 && (
            <section className="bs-panel bs-panel-enter" aria-labelledby={fieldId("modules-title")}>
              <div className="bs-panel-heading">
                <span className="bs-section-icon bs-purple" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                    <path d="M14 17.5h7m-3.5-3.5v7" />
                  </svg>
                </span>
                <div>
                  <h2 id={fieldId("modules-title")} tabIndex={-1} ref={(node) => void (headingRefs.current[1] = node)}>
                    Tu negocio, a tu manera
                  </h2>
                  <p>Activa las funcionalidades que necesita tu negocio hoy. Siempre podrás cambiarlas.</p>
                </div>
              </div>
              <div className="bs-modules-caption">
                <span>{MODULES.length} herramientas para crecer contigo</span>
                <strong role="status">{draft.modules.length === 1 ? "1 seleccionado" : `${draft.modules.length} seleccionados`}</strong>
              </div>
              <div className="bs-module-grid">
                {MODULES.map((module) => (
                  <label className="bs-module-card" key={module.id}>
                    <input type="checkbox" name="modules" value={module.id} aria-label={module.name} checked={draft.modules.includes(module.id)} onChange={() => toggleModule(module.id)} />
                    <span className="bs-module-card-top">
                      <ModuleIcon module={module} />
                      <span className="bs-switch" aria-hidden="true" />
                    </span>
                    <strong>{module.name}</strong>
                    <p>{module.description}</p>
                    <span className="bs-module-tags">
                      {module.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </span>
                  </label>
                ))}
              </div>
              {errors.modules && <p className="bs-error">{errors.modules}</p>}
              <p className="bs-inline-note">Puedes comenzar sin módulos y activarlos más adelante.</p>
            </section>
          )}
          {step === 2 && (
            <section className="bs-panel bs-panel-enter" aria-labelledby={fieldId("boss-title")}>
              <div className="bs-panel-heading">
                <span className="bs-section-icon bs-purple" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="10" cy="7" r="4" />
                    <path d="M3 21v-3a7 7 0 0 1 14 0v3m0-11 2 2 4-4" />
                  </svg>
                </span>
                <div>
                  <h2 id={fieldId("boss-title")} tabIndex={-1} ref={(node) => void (headingRefs.current[2] = node)}>
                    Una persona al frente
                  </h2>
                  <p>Cada negocio necesita un jefe responsable de su operación.</p>
                </div>
              </div>
              {errors.boss && (
                <p className="bs-error" role="alert">
                  {errors.boss}
                </p>
              )}
              {!draft.boss ? (
                <div className="bs-leader-empty">
                  <div className="bs-leader-illustration" aria-hidden="true">
                    <span />
                    <svg viewBox="0 0 64 64">
                      <circle cx="32" cy="22" r="11" />
                      <path d="M12 57v-6a20 20 0 0 1 40 0v6" />
                    </svg>
                    <i>+</i>
                  </div>
                  <h3>¿Quién liderará tu negocio?</h3>
                  <p>Asígnale un nombre y un correo. Su acceso será con un código de un solo uso (OTP).</p>
                  <button type="button" className="ws-primary" onClick={() => setBossOpen(true)}>
                    Asignar jefe de negocio <span aria-hidden="true">+</span>
                  </button>
                  <span className="bs-leader-required">Obligatorio para crear el negocio</span>
                </div>
              ) : (
                <div className="bs-leader-assigned">
                  <div className="bs-person-row">
                    <span className="bs-person-avatar" aria-hidden="true">
                      {initialsOf(draft.boss.name)}
                    </span>
                    <div>
                      <strong>{draft.boss.name}</strong>
                      <span>{draft.boss.email}</span>
                    </div>
                    <span className="bs-ok-badge">Asignado</span>
                  </div>
                  <div className="bs-access-method">
                    <span className="bs-access-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <rect x="4" y="10" width="16" height="11" rx="3" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
                      </svg>
                    </span>
                    <div>
                      <strong>Acceso con correo + OTP</strong>
                      <p>El jefe ingresa su correo y un código de un solo uso que le enviamos por correo.</p>
                    </div>
                  </div>
                  <div className="bs-leader-actions">
                    <button type="button" className="ws-secondary" onClick={() => setBossOpen(true)}>
                      Cambiar responsable
                    </button>
                  </div>
                  {editing && bossReplaced && (
                    <p className="bs-replace-note">
                      Al guardar, {business?.boss.name} dejará de tener acceso a este negocio y {draft.boss.name} recibirá una invitación.
                    </p>
                  )}
                  {editing && !bossReplaced && originalBossEmail && draft.boss.name !== business?.boss.name && (
                    <p className="bs-replace-note">Solo cambia el nombre: no se envía una invitación nueva.</p>
                  )}
                </div>
              )}
              <div className="bs-ready-note">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6" />
                </svg>
                <p>El superadministrador conserva la gestión del negocio desde su workspace.</p>
              </div>
            </section>
          )}
          <footer className="bs-step-footer">
            <span>Paso {step + 1} de 3</span>
            <div>
              <button type="button" className="ws-secondary" onClick={() => (step ? goTo(step - 1) : onCancel())} disabled={submitting}>
                {step ? "← Atrás" : "Cancelar"}
              </button>
              <button type="submit" className="ws-primary" disabled={submitting}>
                {submitting ? (
                  "Guardando…"
                ) : (
                  <>
                    {step === 2 ? (editing ? "Guardar cambios " : "Crear negocio ") : "Continuar "}
                    <span aria-hidden="true">{step === 2 ? "✓" : "→"}</span>
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
        <SummaryPanel
          name={draft.name}
          categoryText={categoryText}
          modules={draft.modules}
          identityReady={identityReady}
          modulesReviewed={modulesReviewed}
          bossName={draft.boss?.name ?? null}
          completed={completed}
        />
      </div>
      <BossDialog
        open={bossOpen}
        initial={draft.boss}
        onClose={() => setBossOpen(false)}
        onSave={(boss) => {
          update("boss", boss);
          setBossOpen(false);
        }}
      />
    </div>
  );
}
