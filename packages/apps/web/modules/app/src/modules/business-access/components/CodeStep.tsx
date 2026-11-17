import { observer } from "mobx-react-lite";
import { useEffect, useId, useState, type FormEvent } from "react";
import { AccessError } from "../api/businessAccessApi";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { formatClock, useTick } from "../hooks/useTick";
import { accessErrorMessage, adminAccessStore } from "../stores/adminAccess.store";

const INVALID_CODE = "El código no es válido o ya venció. Revisa los seis dígitos.";

/**
 * Step 2: the six-digit code. The server never says WHY a code failed (wrong, expired, used or locked all answer
 * the same), so the page keeps its own count of the five tries and its own ten-minute clock for the code it asked
 * for; the server is still the one that decides.
 */
export const CodeStep = observer(({ onHelp }: { onHelp: () => void }) => {
  const store = adminAccessStore;
  const rules = store.rules!;
  const headingRef = useFocusHeading();
  const baseId = useId();
  const codeId = `${baseId}-code`;
  const errorId = `${baseId}-error`;
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [remember, setRemember] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const now = useTick();

  // A new code was requested: the page starts over for it.
  useEffect(() => {
    setCode("");
    setFailures(0);
    setError("");
    document.getElementById(codeId)?.focus();
  }, [store.codeRequestedAt, codeId]);

  const expiresAt = store.codeRequestedAt + rules.expiresInMinutes * 60_000;
  const resendAt = store.codeRequestedAt + rules.resendAfterSeconds * 1000;
  const triesSpent = failures >= rules.maxAttempts;
  const locked = triesSpent && now < resendAt;
  const timeExpired = now >= expiresAt;
  const expired = timeExpired || (triesSpent && now >= resendAt);
  const blocked = locked || expired;
  const wait = resendAt - now;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (blocked || verifying) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Completa los 6 dígitos del código.");
      document.getElementById(codeId)?.focus();
      return;
    }
    setVerifying(true);
    setError("");
    try {
      await store.verify(code, remember);
    } catch (failure) {
      if (failure instanceof AccessError && failure.kind === "invalid-code") {
        setFailures((count) => count + 1);
        setError(INVALID_CODE);
      } else {
        setError(accessErrorMessage(failure));
      }
      setCode("");
      document.getElementById(codeId)?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (wait > 0 || store.busy) return;
    if (await store.resend()) {
      setStatus("Pedimos un código nuevo. Usa siempre el más reciente.");
    } else {
      setStatus("");
    }
  }

  const expiredTitle = triesSpent ? "Necesitas un código nuevo" : "Este código ya venció";

  return (
    <section className="na-view-enter" aria-labelledby={`${baseId}-title`}>
      <button type="button" className="na-back" onClick={() => store.backToEmail()}>
        <span aria-hidden="true">←</span> Cambiar correo
      </button>
      <span className="na-eyebrow">
        <i />
        UN PASO MÁS
      </span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        Revisa tu correo<span>.</span>
      </h1>
      <p className="na-description">Pedimos el envío de un código de 6 dígitos a este correo. Si no llega en un par de minutos, revisa el correo no deseado o pide otro.</p>
      <div className="na-email-chip">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        <span>{store.email}</span>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <label className="na-code-label" htmlFor={codeId}>
          Código de verificación
        </label>
        <div className={`na-otp${blocked ? " is-expired" : ""}`}>
          <div className="na-otp-cells" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className={focused && !blocked && index === Math.min(code.length, 5) ? "is-current" : undefined}>
                {code[index] ?? ""}
              </span>
            ))}
          </div>
          <input
            id={codeId}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            spellCheck={false}
            value={code}
            disabled={blocked}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-describedby={`${errorId} ${baseId}-expiry`}
            aria-invalid={error ? true : undefined}
          />
        </div>
        {error && !blocked && (
          <p id={errorId} className="na-error" role="status">
            {error}
          </p>
        )}
        {!blocked && (
          <p id={`${baseId}-expiry`} className="na-code-expiry">
            Vence en <span>{formatClock(expiresAt - now)}</span>
          </p>
        )}
        {expired && (
          <div className="na-expired" role="status">
            <span className="na-mini-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div>
              <strong>{expiredTitle}</strong>
              <p>Solicita uno nuevo para continuar con tu negocio.</p>
            </div>
          </div>
        )}
        {locked && (
          <div className="na-expired" role="status">
            <div>
              <strong>Hagamos una pequeña pausa</strong>
              <p>
                Se alcanzó el límite de intentos. Podrás pedir un código nuevo en <span aria-live="off">{formatClock(wait)}</span>.
              </p>
            </div>
          </div>
        )}
        <label className="na-remember">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span className="na-checkbox-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path d="m3 8 3 3 7-7" />
            </svg>
          </span>
          <span>
            <strong>Recordar este dispositivo</strong>
            <small>Durante 30 días. Solo en tu equipo personal.</small>
          </span>
        </label>
        <button className="na-primary" type="submit" disabled={blocked || verifying}>
          {verifying ? "Verificando…" : "Verificar y entrar"}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </button>
      </form>
      <div className="na-resend">
        <span>¿No recibiste el código?</span>
        <button type="button" onClick={handleResend} disabled={wait > 0 || store.busy}>
          {wait > 0 ? `Reenviar en ${formatClock(wait)}` : "Reenviar código"}
        </button>
      </div>
      <button type="button" className="na-help-link" onClick={onHelp}>
        Necesito ayuda con el código
      </button>
      <p className="na-inline-status" role="status">
        {store.error ?? status}
      </p>
    </section>
  );
});
