import { useEffect, useRef } from "react";

/** Aviso de que la base quedó preparada. Dice con claridad que los ajustes de cada módulo siguen pendientes. */
export function SavedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="no-saved-dialog" aria-labelledby="no-saved-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="no-saved-symbol" aria-hidden="true">
        <svg viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" />
          <path d="m17 28 8 8 15-17" />
        </svg>
      </div>
      <span className="no-eyebrow">UNA BUENA BASE PARA CRECER</span>
      <h2 id="no-saved-title">
        La base de tu negocio está lista<span>.</span>
      </h2>
      <p>
        Revisaste los datos, el tipo de negocio y sus horarios. Los ajustes específicos de cada módulo quedan para la siguiente etapa.
      </p>
      <button className="no-primary" type="button" onClick={onClose}>
        Ver mis módulos <span aria-hidden="true">→</span>
      </button>
    </dialog>
  );
}
