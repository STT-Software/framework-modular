import { observer } from "mobx-react-lite";
import { useState } from "react";
import { CopyIcon, CheckLineIcon } from "@/icons";
import { turnosStore } from "../stores/turnos.store";
import type { TurnosOperator } from "../types";
import { initialsOf } from "../validation";
import { Modal } from "./Modal";
import { QueuePill } from "./QueueSymbol";

interface Props {
  operator: TurnosOperator | null;
  onClose: () => void;
}

/**
 * Cómo entra un operador. No muestra ningún código: el servidor envía un código real, de un solo uso y con vencimiento, al correo del operador
 * cuando este lo pide en el acceso al negocio (el mismo login del administrador). Aquí solo se le da al administrador el enlace para compartir.
 */
export const AccessDialog = observer(({ operator, onClose }: Props) => {
  const state = turnosStore.state;
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/business/access`;
  const close = () => {
    setCopied(false);
    onClose();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Modal open={operator !== null} onClose={close} labelledBy="nt-otp-title" className="nt-dialog nt-otp-dialog">
      {operator && state && (
        <>
          <header className="nt-dialog-header">
            <div>
              <span className="nt-eyebrow">ACCESO SIN CONTRASEÑA</span>
              <h2 id="nt-otp-title">Acceso del operador</h2>
            </div>
            <button type="button" className="nt-icon-button" aria-label="Cerrar acceso del operador" onClick={close}>
              ×
            </button>
          </header>
          <div className="nt-dialog-body">
            <div className="nt-otp-person">
              <span className="nt-person-avatar">{initialsOf(operator.name)}</span>
              <div className="nt-otp-person-info">
                <strong>{operator.name}</strong>
                <p>{operator.email}</p>
              </div>
              <span className="nt-badge nt-badge-role">Solo Turnos</span>
            </div>
            <p className="nt-otp-desc">
              Entra con su correo en el acceso al negocio y verifica el código de un solo uso que le llega por correo. Después verá únicamente sus filas de Turnos.
            </p>
            <div className="nt-otp-link-card">
              <span className="nt-otp-label">ENLACE DE ACCESO</span>
              <div className="nt-otp-link-row">
                <input
                  type="text"
                  readOnly
                  value={link}
                  className="nt-otp-link-input"
                  aria-label="Enlace de acceso"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`nt-otp-copy-btn ${copied ? "is-copied" : ""}`}
                  onClick={() => void copy()}
                  aria-label="Copiar enlace de acceso"
                >
                  {copied ? (
                    <>
                      <CheckLineIcon className="nt-copy-icon" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="nt-copy-icon" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="nt-help-note">El código se envía a su correo cuando lo solicita y vence pronto. No se muestra aquí ni se guarda en esta pantalla por seguridad.</p>
            {operator.queueIds.length > 0 && (
              <div className="nt-otp-queues-section">
                <span className="nt-otp-label">FILAS ASIGNADAS ({operator.queueIds.length})</span>
                <div className="nt-queue-pills">
                  {operator.queueIds.map((id) => {
                    const queue = state.queues.find((item) => item.id === id);
                    return queue ? <QueuePill key={id} name={queue.name} color={queue.color} /> : null;
                  })}
                </div>
              </div>
            )}
          </div>
          <footer className="nt-dialog-footer">
            <button className="nt-primary" type="button" onClick={close}>
              Listo
            </button>
          </footer>
        </>
      )}
    </Modal>
  );
});
