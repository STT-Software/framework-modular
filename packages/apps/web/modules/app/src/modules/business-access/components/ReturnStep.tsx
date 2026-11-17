import { observer } from "mobx-react-lite";
import { useId } from "react";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { adminAccessStore } from "../stores/adminAccess.store";

const ARROW = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

/**
 * The browser has a valid session: the person can continue WITHOUT another code. This is not a login by email: the
 * server recognized the session cookie of this device. "Use another account" and "forget this device" end that session.
 */
export const ReturnStep = observer(() => {
  const store = adminAccessStore;
  const headingRef = useFocusHeading();
  const baseId = useId();

  return (
    <section className="na-view-enter" aria-labelledby={`${baseId}-title`}>
      <span className="na-eyebrow">
        <i />
        QUÉ BUENO VERTE DE NUEVO
      </span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        Tu negocio
        <br />
        te espera<span>.</span>
      </h1>
      <p className="na-description">Continúa con tu sesión vigente en este dispositivo.</p>
      <div className="na-account-card">
        <span className="na-person-avatar" aria-hidden="true">
          {(store.email[0] ?? "A").toUpperCase()}
        </span>
        <div>
          <strong>Administrador de negocio</strong>
          <span>{store.email}</span>
        </div>
        <svg className="na-session-check" viewBox="0 0 24 24" aria-label="Sesión vigente">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      </div>
      {store.error && (
        <p className="na-error" role="alert">
          {store.error}
        </p>
      )}
      <button className="na-primary" type="button" disabled={store.busy} onClick={() => void store.continueWithSession()}>
        {store.busy ? "Continuando…" : "Continuar con mi sesión"}
        {ARROW}
      </button>
      <button
        className="na-secondary na-switch-account"
        type="button"
        disabled={store.busy}
        onClick={() => void store.leave("Ingresa el correo de la cuenta con la que quieres continuar.")}
      >
        Usar otra cuenta
      </button>
      <p className="na-return-note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6" />
        </svg>
        Tu acceso se confirma con la sesión guardada, sin volver a escribir el código.
      </p>
      <button
        className="na-help-link"
        type="button"
        disabled={store.busy}
        onClick={() => void store.leave("Dispositivo olvidado. Necesitarás un código para volver a entrar.")}
      >
        Olvidar este dispositivo
      </button>
    </section>
  );
});
