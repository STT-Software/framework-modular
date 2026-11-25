import { Modal } from "./Modal";

/** Aviso de que la configuración de Turnos quedó preparada.  */
export function SavedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="nt-saved-title" className="nt-dialog nt-saved-dialog">
      <div className="nt-saved-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" />
          <path d="m20 32 8 8 17-18" pathLength="1" />
        </svg>
      </div>
      <span className="nt-eyebrow">UNA BUENA FORMA DE EMPEZAR</span>
      <h2 id="nt-saved-title">
        Turnos, preparado a tu manera<span>.</span>
      </h2>
      <p>Filas, reglas y equipo quedaron guardados. Ya puedes entrar a tu dashboard y abrir Turnos para atender.</p>
      <button className="nt-primary" type="button" onClick={onClose}>
        Ir a mi dashboard
      </button>
    </Modal>
  );
}
