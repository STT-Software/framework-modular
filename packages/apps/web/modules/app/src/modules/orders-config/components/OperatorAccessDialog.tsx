import { useEffect, useRef, useState } from "react";
import { Button } from "@/elements/ui/button";
import { CheckLineIcon, CopyIcon } from "@/icons";
import { ALL_OPERATOR_STAGES, type OrderOperator, type OrderOperatorStage } from "../types";
import { initialsOf } from "../validation";

const stageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

interface OperatorAccessDialogProps {
  operator: OrderOperator | null;
  onClose: () => void;
}

/**
 * Shows the business access URL that an administrator can share with a Pedidos operator.
 * Never reveals or stores OTP codes — real single-use codes are emailed on demand via `/business/access`.
 */
export function OperatorAccessDialog({ operator, onClose }: OperatorAccessDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const open = operator !== null;
  const link = typeof window !== "undefined" ? `${window.location.origin}/business/access` : "/business/access";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
    <dialog
      ref={dialogRef}
      className="oc-dialog oc-otp-dialog"
      aria-labelledby="oc-otp-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== dialogRef.current) return;
        const box = dialogRef.current.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        ) {
          close();
        }
      }}
    >
      {open && operator ? (
        <>
          <header className="oc-dialog-header">
            <div>
              <span className="oc-eyebrow">ACCESO SIN CONTRASEÑA</span>
              <h2 id="oc-otp-title">Acceso del operador</h2>
            </div>
            <button
              type="button"
              className="oc-icon-button"
              aria-label="Cerrar acceso del operador"
              onClick={close}
            >
              ×
            </button>
          </header>
          <div className="oc-dialog-body">
            <div className="oc-otp-person">
              <span className="oc-person-avatar">{initialsOf(operator.name)}</span>
              <div className="oc-otp-person-info">
                <strong>{operator.name}</strong>
                <p>{operator.email}</p>
              </div>
              <span className="oc-badge-role">Solo Pedidos</span>
            </div>

            <p className="oc-otp-desc">
              Entra con su correo en el acceso al negocio y verifica el código de un solo uso que le llega por correo.
              Después verá únicamente su acceso de operador de Pedidos.
            </p>

            <div className="oc-otp-link-card">
              <span className="oc-otp-label">ENLACE DE ACCESO</span>
              <div className="oc-otp-link-row">
                <input
                  type="text"
                  readOnly
                  value={link}
                  className="oc-otp-link-input"
                  aria-label="Enlace de acceso"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`oc-otp-copy-btn ${copied ? "is-copied" : ""}`}
                  onClick={() => void copy()}
                  aria-label="Copiar enlace de acceso"
                >
                  {copied ? (
                    <>
                      <CheckLineIcon className="oc-copy-icon" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="oc-copy-icon" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="oc-help-note">
              El código se envía a su correo cuando lo solicita y vence pronto. No se muestra aquí ni se guarda en esta
              pantalla por seguridad.
            </p>

            {operator.stages.length > 0 && (
              <div className="oc-otp-stages-section">
                <span className="oc-otp-label">
                  {operator.stages.length === ALL_OPERATOR_STAGES.length
                    ? "ETAPAS ASIGNADAS (TODAS)"
                    : `ETAPAS ASIGNADAS (${operator.stages.length})`}
                </span>
                <div className="oc-stage-badges">
                  {operator.stages.map((stage) => (
                    <span key={stage} className="oc-stage-badge">
                      {stageLabels[stage]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <footer className="oc-dialog-footer">
            <Button className="oc-primary" type="button" onClick={close}>
              Listo
            </Button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
