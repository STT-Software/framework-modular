import { useCallback, useEffect, useRef, useState } from "react";
import { businessesApi } from "../api/businessesApi";
import { businessErrorMessage } from "../errors";
import type { Business, DeliveryFailureCode, InvitationStatus, TemporaryCode } from "../types";

const POLL_MS = 2000;
const MAX_POLLS = 6;

const FAILURE_TEXT: Record<DeliveryFailureCode, string> = {
  "not-configured": "El servicio de correo aún no está configurado en este entorno.",
  rejected: "El proveedor de correo rechazó el mensaje. Revisa que el correo del jefe sea correcto.",
  timeout: "El proveedor de correo tardó demasiado en responder.",
  connection: "No pudimos conectar con el proveedor de correo.",
  unknown: "El envío falló por un motivo que no pudimos identificar.",
};

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

/** The time format already ends with a period ("05:28 p. m."): do not add another one at the end of the sentence. */
function sentence(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

function secondsUntil(iso: string | null, now: number): number {
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;
}

/**
 * The state of the invitation sent to the boss. It only says what is known: the provider took the message
 * ("accepted"), or it failed. It never says the person received it, because nothing can confirm that.
 */
export function InvitationPanel({ business }: { business: Business }) {
  const [invitation, setInvitation] = useState<InvitationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // A temporary code lives only in this panel: it is shown once and gone when the panel closes.
  const [temporary, setTemporary] = useState<TemporaryCode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState("");
  const codeRef = useRef<HTMLOutputElement>(null);
  const businessId = business.id;

  const refresh = useCallback(async () => {
    try {
      setInvitation(await businessesApi.invitation(businessId));
      setError(null);
    } catch (failure) {
      setError(businessErrorMessage(failure));
    }
  }, [businessId]);

  useEffect(() => {
    setInvitation(null);
    void refresh();
  }, [refresh, business.boss.email]);

  // The email is sent in the background: while it is still "sending", look again a few times.
  useEffect(() => {
    if (invitation?.status !== "sending") return;
    let polls = 0;
    const timer = window.setInterval(() => {
      polls += 1;
      void refresh();
      if (polls >= MAX_POLLS) window.clearInterval(timer);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [invitation?.status, refresh]);

  const waiting = secondsUntil(invitation?.resendAvailableAt ?? null, now);
  useEffect(() => {
    if (!invitation?.resendAvailableAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [invitation?.resendAvailableAt]);

  async function resend() {
    setSending(true);
    setError(null);
    try {
      setInvitation(await businessesApi.resendInvitation(businessId));
    } catch (failure) {
      setError(businessErrorMessage(failure));
    } finally {
      setSending(false);
    }
  }

  // Another business, or another boss: the code on screen is no longer the right one.
  useEffect(() => {
    setTemporary(null);
    setCopied("");
  }, [businessId, business.boss.email]);

  async function generateTemporaryCode() {
    setGenerating(true);
    setError(null);
    setCopied("");
    try {
      setTemporary(await businessesApi.temporaryCode(businessId));
    } catch (failure) {
      setError(businessErrorMessage(failure));
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode() {
    if (!temporary) return;
    try {
      await navigator.clipboard.writeText(temporary.code);
      setCopied("Código copiado.");
    } catch {
      // Without clipboard access (an insecure page, a blocked permission): select it so the person can copy it by hand.
      const range = document.createRange();
      if (codeRef.current) range.selectNodeContents(codeRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setCopied("Código seleccionado. Cópialo con el teclado.");
    }
  }

  const paused = business.status === "paused";
  const failed = invitation?.status === "failed";
  const canResend = !paused && !sending && waiting === 0 && invitation !== null && invitation.status !== "sending";

  return (
    <div className={`bs-invite${failed ? " is-failed" : ""}`} aria-live="polite">
      <strong>Invitación por correo</strong>
      {invitation === null && !error && <p>Consultando el estado…</p>}
      {invitation?.status === "none" && <p>Aún no se ha enviado ninguna invitación a {business.boss.email}.</p>}
      {invitation?.status === "sending" && <p>Enviando la invitación a {invitation.bossEmail}…</p>}
      {invitation?.status === "accepted" && (
        <p>
          El proveedor de correo aceptó la invitación para {invitation.bossEmail}
          {invitation.acceptedAt ? ` (a las ${timeFormat.format(new Date(invitation.acceptedAt))})` : ""}. Esto no confirma que la persona la haya
          recibido.
          {invitation.expired
            ? " El código ya venció: envía una invitación nueva."
            : invitation.expiresAt
              ? ` El código vence a las ${sentence(timeFormat.format(new Date(invitation.expiresAt)))}`
              : ""}
        </p>
      )}
      {failed && invitation?.failureCode && (
        <p>
          No se pudo enviar la invitación a {invitation.bossEmail}. {FAILURE_TEXT[invitation.failureCode]}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {paused && <p>Reanuda el negocio para poder enviar una invitación.</p>}
      {temporary && (
        <div className="bs-temp-code">
          <strong>Código temporal para {temporary.bossEmail}</strong>
          <output ref={codeRef} aria-label="Código temporal">
            {temporary.code}
          </output>
          <div className="bs-temp-actions">
            <button type="button" className="bs-text-button" onClick={() => void copyCode()}>
              Copiar código
            </button>
            <span role="status">{copied}</span>
          </div>
          <p>
            Vence a las {timeFormat.format(new Date(temporary.expiresAt))} y sirve una sola vez. La persona entra a {window.location.origin}/business/access, escribe su
            correo y usa este código.
          </p>
          <p className="bs-temp-warning">Quien tenga este código puede entrar como esta persona: compártelo solo con ella. No volverás a verlo; si lo pierdes, genera otro.</p>
        </div>
      )}
      {invitation && (
        <div className="bs-invite-actions">
          <button type="button" className="bs-text-button" onClick={resend} disabled={!canResend}>
            {sending ? "Enviando…" : waiting > 0 ? `Enviar de nuevo (disponible en ${waiting} s)` : "Enviar invitación de nuevo"}
          </button>
          <button type="button" className="bs-text-button" onClick={() => void generateTemporaryCode()} disabled={paused || generating}>
            {generating ? "Generando…" : temporary ? "Generar otro código temporal" : "Generar código temporal"}
          </button>
        </div>
      )}
    </div>
  );
}
