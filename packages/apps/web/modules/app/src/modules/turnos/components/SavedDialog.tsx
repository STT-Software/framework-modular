import { Modal } from "./Modal";

/** Aviso de que la configuración de Turnos quedó preparada. La atención de turnos es una etapa posterior y aquí se dice con claridad. */
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
      <p>Filas, reglas y equipo quedaron guardados. La atención de turnos y la pantalla de sala serán la siguiente etapa.</p>
      <button className="nt-primary" type="button" onClick={onClose}>
        Ver mis módulos
      </button>
    </Modal>
  );
}
