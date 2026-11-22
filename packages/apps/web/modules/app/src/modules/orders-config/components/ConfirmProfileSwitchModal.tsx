import { useEffect, useRef } from "react";
import { Button } from "@/elements/ui/button";
import { PROFILE_DEFAULTS } from "../constants";
import type { OrdersProfileId } from "../types";

interface ConfirmProfileSwitchModalProps {
  targetProfile: OrdersProfileId | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Native accessible confirmation dialog shown before overwriting customized settings when switching profile.
 */
export function ConfirmProfileSwitchModal({ targetProfile, onCancel, onConfirm }: ConfirmProfileSwitchModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = targetProfile !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const profileInfo = targetProfile ? PROFILE_DEFAULTS[targetProfile] : null;

  return (
    <dialog
      ref={dialogRef}
      className="oc-dialog"
      aria-labelledby="oc-profile-switch-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
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
          onCancel();
        }
      }}
    >
      {open && profileInfo ? (
        <>
          <header className="oc-dialog-header">
            <div>
              <span className="oc-eyebrow">CAMBIO DE PERFIL</span>
              <h2 id="oc-profile-switch-title">¿Aplicar el perfil «{profileInfo.name}»?</h2>
            </div>
            <button
              type="button"
              className="oc-icon-button"
              aria-label="Cerrar confirmación de cambio de perfil"
              onClick={onCancel}
            >
              ×
            </button>
          </header>
          <div className="oc-dialog-body">
            <p>
              Ya realizaste ajustes en tu configuración actual. Si aplicas este perfil, se reemplazarán las modalidades,
              reglas de confirmación y envío, transportadoras, pagos y políticas, y tiempos objetivo con los valores
              sugeridos de «{profileInfo.name}».
            </p>
            <div className="oc-info-box">
              <p>Tus operadores asignados se conservarán sin cambios.</p>
            </div>
          </div>
          <footer className="oc-dialog-footer">
            <Button variant="outline" type="button" className="oc-secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" className="oc-primary" onClick={onConfirm}>
              Aplicar perfil
            </Button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
