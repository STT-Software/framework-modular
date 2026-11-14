import { useCallback, useEffect, useState } from "react";
import { businessesApi } from "../api/businessesApi";
import { businessErrorMessage } from "../errors";
import type { Business, DeliveryFailureCode, InvitationStatus } from "../types";

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
              ? ` El código vence a las ${timeFormat.format(new Date(invitation.expiresAt))}`
              : ""}
          {invitation.expired || !invitation.expiresAt ? "" : "."}
        </p>
      )}
      {failed && invitation?.failureCode && (
        <p>
          No se pudo enviar la invitación a {invitation.bossEmail}. {FAILURE_TEXT[invitation.failureCode]}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {paused && <p>Reanuda el negocio para poder enviar una invitación.</p>}
      {invitation && (
        <div className="bs-invite-actions">
          <button type="button" className="bs-text-button" onClick={resend} disabled={!canResend}>
            {sending ? "Enviando…" : waiting > 0 ? `Enviar de nuevo (disponible en ${waiting} s)` : "Enviar invitación de nuevo"}
          </button>
        </div>
      )}
    </div>
  );
}
