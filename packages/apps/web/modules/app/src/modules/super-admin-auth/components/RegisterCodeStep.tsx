import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert } from "@/elements/ui/alert";
import { formatClock, useTick } from "@/hooks/useTick";
import {
  superAdminAuthApi,
  SuperAdminAuthError,
  type LoginResult,
  type PendingRegistration,
} from "../api/superAdminAuthApi";
import { FormHeading } from "./FormHeading";
import { SubmitButton } from "./SubmitButton";

interface RegisterCodeStepProps {
  pending: PendingRegistration;
  /** A new code was sent (resend or restart): the step starts over for it. */
  onPendingChange: (pending: PendingRegistration) => void;
  onVerified: (result: LoginResult) => void;
  /** Back to the form, with the data the person typed. */
  onChangeEmail: () => void;
  /** The pending registration is gone (expired or used): register again with the same data. */
  onRestart: () => Promise<PendingRegistration>;
  /** A username / email / document was taken meanwhile: back to the form so the field shows the conflict. */
  onConflict: (error: SuperAdminAuthError) => void;
}

type Blocked = "none" | "attempts" | "expired";

/** Spanish message for a failed verify / resend. */
export function codeErrorMessage(error: unknown): string {
  if (error instanceof SuperAdminAuthError) {
    switch (error.kind) {
      case "invalid-code":
        return "El código no es correcto. Revisa los seis dígitos.";
      case "too-many-codes":
        return "Enviamos demasiados códigos a este correo. Espera unos minutos e inténtalo de nuevo.";
      case "resend-too-soon":
        return "Espera un momento antes de pedir otro código.";
      case "rate-limited":
        return "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "validation":
        return "Revisa el código ingresado.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}

/**
 * Register step 2: the six-digit code sent by email. Based on business-access `CodeStep`: six visual cells over
 * one real input (typing, paste and one-time-code autofill), expiry and resend countdowns (`useTick`, paused while
 * the tab is hidden). The server decides; the page only mirrors its dates and stable error codes.
 */
export function RegisterCodeStep({
  pending,
  onPendingChange,
  onVerified,
  onChangeEmail,
  onRestart,
  onConflict,
}: RegisterCodeStepProps) {
  const baseId = useId();
  const codeId = `${baseId}-code`;
  const errorId = `${baseId}-error`;
  const expiryId = `${baseId}-expiry`;
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [blocked, setBlocked] = useState<Blocked>("none");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const now = useTick();

  const expiresAt = Date.parse(pending.expiresAt);
  const resendAt = Date.parse(pending.resendAvailableAt);
  const isBlocked = blocked !== "none" || now >= expiresAt;
  const wait = resendAt - now;
  // After expiry the pending registration is gone: the button registers again, no cooldown applies.
  const mustRestart = blocked === "expired" || now >= expiresAt;
  const canResend = mustRestart || wait <= 0;

  // A new code was sent: start over and put the focus on the code.
  useEffect(() => {
    setCode("");
    setError("");
    setBlocked("none");
    document.getElementById(codeId)?.focus();
  }, [pending, codeId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBlocked || verifying) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Completa los 6 dígitos del código.");
      document.getElementById(codeId)?.focus();
      return;
    }
    setVerifying(true);
    setError("");
    setStatus("");
    try {
      const result = await superAdminAuthApi.verifyRegistration({ registrationId: pending.registrationId, code });
      onVerified(result);
    } catch (failure) {
      if (failure instanceof SuperAdminAuthError && failure.kind === "conflict") {
        onConflict(failure);
        return;
      }
      if (failure instanceof SuperAdminAuthError && failure.kind === "too-many-attempts") setBlocked("attempts");
      else if (failure instanceof SuperAdminAuthError && failure.kind === "code-expired") setBlocked("expired");
      else setError(codeErrorMessage(failure));
      setCode("");
      document.getElementById(codeId)?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function sendNewCode() {
    if (sending || !canResend) return;
    setSending(true);
    setError("");
    setStatus("");
    try {
      const next = mustRestart
        ? await onRestart()
        : await superAdminAuthApi.resendRegistrationCode(pending.registrationId);
      onPendingChange(next);
      setStatus("Te enviamos un código nuevo. Usa siempre el más reciente.");
    } catch (failure) {
      if (failure instanceof SuperAdminAuthError && failure.kind === "code-expired") {
        setBlocked("expired");
      } else if (failure instanceof SuperAdminAuthError && failure.kind === "conflict") {
        onConflict(failure);
      } else {
        setError(codeErrorMessage(failure));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="sa-fade-in" aria-labelledby={`${baseId}-title`}>
      <button type="button" className="sa-back" onClick={onChangeEmail} disabled={verifying || sending}>
        <span aria-hidden="true">←</span> Cambiar correo
      </button>
      <FormHeading
        id={`${baseId}-title`}
        eyebrow="UN PASO MÁS"
        title="Verifica tu correo"
        subtitle="Enviamos un código de 6 dígitos a este correo. Si no llega en un par de minutos, revisa el correo no deseado o pide otro."
      />
      <div className="sa-email-chip">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        <span>{pending.email}</span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <label className="mb-2 block text-[14px] font-bold text-[#212121] dark:text-[#ECECEC]" htmlFor={codeId}>
          Código de verificación
        </label>
        <div className={`sa-otp${isBlocked ? " is-blocked" : ""}`}>
          <div className="sa-otp-cells" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={focused && !isBlocked && index === Math.min(code.length, 5) ? "is-current" : undefined}
              >
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
            disabled={isBlocked}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-describedby={`${errorId} ${expiryId}`}
            aria-invalid={error ? true : undefined}
          />
        </div>
        {!isBlocked && (
          <p id={expiryId} className="sa-code-expiry">
            Vence en <span>{formatClock(expiresAt - now)}</span>
          </p>
        )}
        <div id={errorId} aria-live="polite">
          {error && (
            <div className="mt-4">
              <Alert variant="error" title="No pudimos verificar el código" message={error} />
            </div>
          )}
          {isBlocked && (
            <div className="mt-4">
              <Alert
                variant="warning"
                title={blocked === "attempts" ? "Se alcanzó el límite de intentos" : "Este código ya venció"}
                message={
                  blocked === "attempts"
                    ? "Por seguridad, pide un código nuevo para continuar."
                    : "Pide un código nuevo para terminar de crear tu cuenta."
                }
              />
            </div>
          )}
        </div>
        {!isBlocked && <SubmitButton loading={verifying}>Verificar y crear cuenta</SubmitButton>}
      </form>

      <div className="sa-resend">
        <span>¿No recibiste el código?</span>
        <button type="button" onClick={sendNewCode} disabled={!canResend || sending}>
          {sending ? "Enviando…" : canResend ? "Reenviar código" : `Reenviar en ${formatClock(wait)}`}
        </button>
      </div>
      <p className="mt-3 min-h-5 text-center text-[13px] text-[#212121]/70 dark:text-[#ECECEC]/70" role="status">
        {status}
      </p>
    </section>
  );
}
