import { observer } from "mobx-react-lite";
import { useId, useState, type FormEvent } from "react";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { adminAccessStore } from "../stores/adminAccess.store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

/** Step 1: the email the superadmin assigned to the business. Nothing about the email is revealed here or by the server. */
export const EmailStep = observer(({ onHelp }: { onHelp: () => void }) => {
  const store = adminAccessStore;
  const headingRef = useFocusHeading();
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const errorId = `${baseId}-error`;
  const [email, setEmail] = useState(store.email);
  const [localError, setLocalError] = useState("");
  const error = localError || store.error || "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value) || value.length > 254) {
      setLocalError("Escribe un correo electrónico válido.");
      document.getElementById(emailId)?.focus();
      return;
    }
    setLocalError("");
    await store.submitEmail(value.toLowerCase());
  }

  return (
    <section className="na-view-enter" aria-labelledby={`${baseId}-title`}>
      <span className="na-eyebrow">
        <i />
        ACCESO A TU NEGOCIO
      </span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        Entra a tu negocio<span>.</span>
      </h1>
      <p className="na-description">Tu correo. Un código. Y todo listo para comenzar.</p>
      {store.notice && (
        <div className="na-notice" role="status">
          {store.notice}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="na-field">
          <Label htmlFor={emailId}>Correo electrónico</Label>
          <div className="na-input-wrap">
            {MAIL_ICON}
            <Input
              id={emailId}
              name="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setLocalError("");
              }}
              autoComplete="username"
              placeholder="nombre@tunegocio.com"
              required
              maxLength={160}
              error={Boolean(error)}
              aria-describedby={error ? `${errorId} ${baseId}-hint` : `${baseId}-hint`}
            />
          </div>
          {error && (
            <p id={errorId} className="na-error" role="alert">
              {error}
            </p>
          )}
          <p id={`${baseId}-hint`} className="na-field-hint">
            Usa el correo que asignaron a tu negocio.
          </p>
        </div>
        <button className="na-primary" type="submit" disabled={store.busy}>
          {store.busy ? "Enviando…" : "Continuar con mi correo"}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </button>
      </form>
      <div className="na-passwordless-note">
        <span className="na-mini-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="4" y="10" width="16" height="11" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
          </svg>
        </span>
        <p>
          <strong>Sin contraseñas que recordar.</strong>
          <span>Verificamos tu acceso con un código de un solo uso.</span>
        </p>
      </div>
      <p className="na-support-copy">
        ¿Aún no tienes acceso?{" "}
        <button type="button" onClick={onHelp}>
          Habla con tu superadministrador
        </button>
      </p>
    </section>
  );
});
