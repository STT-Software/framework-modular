import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Icon } from "./ui";
interface AppDialogProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  wide?: boolean;
  /** Texto del botón que confirma; vacío o ausente: la ventana solo informa y se cierra con «Cerrar». */
  submitLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  /** Botones extra a la izquierda del pie. */
  footerExtra?: ReactNode;
  onClose: () => void;
  onSubmit?: () => void | Promise<void>;
  children: ReactNode;
}
/**
 * La ventana modal de la referencia (`nd-dialog`): un `<dialog>` nativo (foco atrapado y Escape gratis), con su encabezado,
 * un cuerpo, el aviso de error del formulario y el pie con «Cancelar» y la acción. Solo se pinta mientras está abierta.
 */
export function AppDialog({ open, title, eyebrow = "TURNOS · NECTO", description, wide, submitLabel, danger, busy, error, footerExtra, onClose, onSubmit, children }: AppDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (error) ref.current?.querySelector(".nd-dialog-error")?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (onSubmit && !busy) void onSubmit();
  };
  return (
    <dialog ref={ref} className={`nd-dialog${wide ? " wide" : ""}`} aria-labelledby="nd-dialog-title" onClose={onClose} onCancel={onClose}>
      {open ? (
        <form onSubmit={submit} noValidate>
          <header className="nd-dialog-header">
            <div>
              <span className="nd-eyebrow">{eyebrow}</span>
              <h2 id="nd-dialog-title">{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <button type="button" className="nd-icon-button" aria-label="Cerrar ventana" onClick={onClose}>
              <Icon name="close" wrap />
            </button>
          </header>
          <div className="nd-dialog-body">{children}</div>
          <p className="nd-error nd-dialog-error" role="status" hidden={!error}>
            {error}
          </p>
          <footer className="nd-dialog-footer">
            {footerExtra}
            <button type="button" className="nd-secondary" onClick={onClose}>
              {submitLabel ? "Cancelar" : "Cerrar"}
            </button>
            {submitLabel ? (
              <button type="submit" className={danger ? "nd-danger" : "nd-primary"} disabled={busy}>
                {submitLabel}
              </button>
            ) : null}
          </footer>
        </form>
      ) : null}
    </dialog>
  );
}
