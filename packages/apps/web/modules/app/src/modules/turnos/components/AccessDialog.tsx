import { observer } from "mobx-react-lite";
import { useState } from "react";
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
              <div>
                <strong>{operator.name}</strong>
                <p>{operator.email}</p>
              </div>
              <span className="nt-badge">Solo Turnos</span>
            </div>
            <p>
              Entra con su correo en el acceso al negocio y verifica el código de un solo uso que le llega por correo. Después verá únicamente sus filas de Turnos.
            </p>
            <div className="nt-otp-example">
              <span>ENLACE DE ACCESO</span>
              <strong aria-label="Enlace de acceso">{link}</strong>
              <button type="button" className="nt-text-button" onClick={() => void copy()}>
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
            </div>
            <p className="nt-help-note">El código se envía a su correo cuando lo solicita y vence pronto. No se muestra aquí ni se guarda en esta pantalla.</p>
            <div className="nt-queue-pills">
              {operator.queueIds.map((id) => {
                const queue = state.queues.find((item) => item.id === id);
                return queue ? <QueuePill key={id} name={queue.name} color={queue.color} /> : null;
              })}
            </div>
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
