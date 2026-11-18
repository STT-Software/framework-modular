import { observer } from "mobx-react-lite";
import { useRef, type ReactNode } from "react";
import { categoryLabel } from "@/modules/businesses";
import { initialsOf } from "../initials";
import { businessSetupStore } from "../stores/businessSetup.store";
import type { ProfileForm } from "../types";

interface FieldProps {
  field: keyof ProfileForm;
  label: ReactNode;
  full?: boolean;
  children: (props: { id: string; value: string; invalid: boolean; describedBy: string; onChange: (value: string) => void }) => ReactNode;
}

const Field = observer(({ field, label, full, children }: FieldProps) => {
  const store = businessSetupStore;
  const id = `no-${field}`;
  const message = store.formErrors[field];
  return (
    <div className={`no-field${full ? " no-full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        value: store.form[field],
        invalid: Boolean(message),
        describedBy: `${id}-error`,
        onChange: (value) => store.setField(field, value),
      })}
      <p id={`${id}-error`} className="no-error" hidden={!message}>
        {message}
      </p>
    </div>
  );
});

/** Paso 1: los datos que registró el superadministrador, ya cargados, más la descripción y el logo. */
export const DataPanel = observer(({ categoryPath, onOpenCategory }: { categoryPath: string; onOpenCategory: () => void }) => {
  const store = businessSetupStore;
  const state = store.state;
  const fileRef = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const name = store.form.name || state.profile.name;
  return (
    <section className="no-panel no-panel-enter" aria-label="Datos del negocio">
      <div className="no-card no-data-card">
        <header className="no-card-header">
          <div>
            <h2>Datos del negocio</h2>
            <p>Compartidos por todos tus módulos.</p>
          </div>
          <span className="no-source-badge">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
            Precargados
          </span>
        </header>
        <div className="no-logo-upload">
          <div className="no-logo-preview">
            {store.logoUrl ? <img src={store.logoUrl} alt="Logo del negocio" /> : <span>{initialsOf(name)}</span>}
          </div>
          <div>
            <strong>Logo de tu negocio</strong>
            <div>
              <label className="no-upload-button" htmlFor="no-logo-file">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5" />
                </svg>
                Subir imagen
              </label>
              <input
                ref={fileRef}
                className="no-file-input"
                id="no-logo-file"
                type="file"
                accept="image/png,image/jpeg"
                disabled={store.saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void store.chooseLogo(file);
                }}
              />
              {state.logo && (
                <button type="button" className="no-text-button" disabled={store.saving} onClick={() => void store.removeLogo()}>
                  Quitar
                </button>
              )}
            </div>
            <p>PNG o JPG, hasta 1 MB.</p>
          </div>
        </div>
        <p className="no-error" role="status" hidden={!store.logoError}>
          {store.logoError}
        </p>
        <div className="no-fields">
          <Field field="name" label={<>Nombre del negocio <span>*</span></>}>
            {(p) => (
              <input
                id={p.id}
                value={p.value}
                autoComplete="organization"
                maxLength={80}
                required
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
          <Field field="phone" label="Teléfono">
            {(p) => (
              <input
                id={p.id}
                type="tel"
                value={p.value}
                autoComplete="tel"
                placeholder="+57 300 123 4567"
                maxLength={25}
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
          <Field field="supportEmail" label="Correo de contacto">
            {(p) => (
              <input
                id={p.id}
                type="email"
                value={p.value}
                autoComplete="email"
                placeholder="contacto@tunegocio.com"
                maxLength={160}
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
          <Field field="address" label="Dirección">
            {(p) => (
              <input
                id={p.id}
                value={p.value}
                autoComplete="street-address"
                placeholder="Calle, número y ciudad"
                maxLength={180}
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
          <Field field="legalName" label="Razón social">
            {(p) => (
              <input id={p.id} value={p.value} maxLength={120} placeholder="Nombre legal de la empresa" aria-describedby={p.describedBy} onChange={(e) => p.onChange(e.target.value)} />
            )}
          </Field>
          <Field field="taxId" label="NIT / ID fiscal">
            {(p) => (
              <input
                id={p.id}
                value={p.value}
                maxLength={40}
                placeholder="Ej. 900.123.456-7"
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
          <Field
            field="website"
            full
            label={
              <>
                Sitio web <small>Opcional</small>
              </>
            }
          >
            {(p) => (
              <input
                id={p.id}
                type="url"
                value={p.value}
                autoComplete="url"
                placeholder="https://tunegocio.com"
                maxLength={200}
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
          <Field
            field="description"
            full
            label={
              <>
                ¿A qué se dedica tu negocio? <small>Opcional</small>
              </>
            }
          >
            {(p) => (
              <textarea
                id={p.id}
                value={p.value}
                rows={3}
                maxLength={400}
                placeholder="Cuéntanos brevemente qué ofreces."
                aria-describedby={p.describedBy}
                onChange={(e) => p.onChange(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="no-data-category">
          <span>Categoría registrada</span>
          <strong>{categoryLabel(state.category.id, state.category.other)}</strong>
          <a
            href={categoryPath}
            onClick={(event) => {
              event.preventDefault();
              onOpenCategory();
            }}
          >
            Revisar tipo <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <p className="no-field-note">
        Los campos con <b>*</b> son obligatorios. La información disponible se toma de la configuración del negocio.
      </p>
    </section>
  );
});
