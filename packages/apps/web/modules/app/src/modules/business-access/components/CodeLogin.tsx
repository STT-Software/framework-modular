import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { AccessError, businessAccessApi } from "../api/businessAccessApi";
import { bossSessionStore } from "../stores/bossSession.store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE = /^\d{6}$/;
/** Same cooldown the service applies between two codes for the same person. */
const RESEND_SECONDS = 60;

function accessMessage(error: unknown): string {
  if (error instanceof AccessError) {
    switch (error.kind) {
      case "invalid-code":
        return "El código no es válido o ya venció. Revisa los 6 dígitos o pide uno nuevo.";
      case "rate-limited":
        return error.retryAfterSeconds
          ? `Demasiados intentos. Espera ${error.retryAfterSeconds < 90 ? `${error.retryAfterSeconds} segundos` : `${Math.ceil(error.retryAfterSeconds / 60)} minutos`} e inténtalo de nuevo.`
          : "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "validation":
        return "Revisa los datos ingresados.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}

/** Two steps: the email of the boss, then the six-digit code that arrives by email. */
export function CodeLogin({ businessId }: { businessId: string }) {
  const baseId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const emailId = `${baseId}-email`;
  const codeId = `${baseId}-code`;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (!EMAIL.test(email.trim())) {
      setError("Escribe un correo electrónico válido.");
      document.getElementById(emailId)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await businessAccessApi.requestCode(businessId, email.trim().toLowerCase());
      // The service answers the same for every email, so this does not mean a code was sent: it says so honestly.
      setStep("code");
      setCode("");
      setWait(RESEND_SECONDS);
      setInfo("Si este correo es el del jefe de este negocio, te enviamos un código de 6 dígitos. Puede tardar un par de minutos.");
    } catch (failure) {
      setError(accessMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!CODE.test(code)) {
      setError("El código tiene 6 dígitos.");
      document.getElementById(codeId)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      bossSessionStore.signIn(await businessAccessApi.verifyCode(businessId, email.trim().toLowerCase(), code));
    } catch (failure) {
      setError(accessMessage(failure));
      document.getElementById(codeId)?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ba-card" aria-labelledby={`${baseId}-title`}>
      <span className="ba-eyebrow">ACCESO DEL JEFE DE NEGOCIO</span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        {step === "email" ? "Entra a tu negocio" : "Revisa tu correo"}
      </h1>
      {step === "email" ? (
        <form onSubmit={requestCode} noValidate>
          <p className="ba-lead">Escribe el correo con el que te invitaron. Te enviaremos un código de un solo uso, sin contraseñas.</p>
          <div className="ba-field">
            <Label htmlFor={emailId}>Correo electrónico</Label>
            <Input
              id={emailId}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder="andrea@tunegocio.com"
              autoComplete="email"
              maxLength={254}
              required
              error={Boolean(error)}
              aria-describedby={error ? `${baseId}-error` : undefined}
            />
          </div>
          {error && (
            <p id={`${baseId}-error`} className="ba-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="ba-primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviarme el código"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          {info && <p className="ba-lead">{info}</p>}
          <div className="ba-field">
            <Label htmlFor={codeId}>Código de 6 dígitos</Label>
            <Input
              id={codeId}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="123456"
              autoComplete="one-time-code"
              maxLength={6}
              required
              error={Boolean(error)}
              aria-describedby={error ? `${baseId}-error` : undefined}
              className="ba-code-input"
            />
          </div>
          {error && (
            <p id={`${baseId}-error`} className="ba-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="ba-primary" disabled={busy}>
            {busy ? "Verificando…" : "Entrar"}
          </button>
          <div className="ba-links">
            <button type="button" className="ba-link" onClick={() => void requestCode()} disabled={busy || wait > 0}>
              {wait > 0 ? `Pedir otro código (en ${wait} s)` : "Pedir otro código"}
            </button>
            <button
              type="button"
              className="ba-link"
              onClick={() => {
                setStep("email");
                setError(null);
                setInfo(null);
              }}
            >
              Usar otro correo
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
