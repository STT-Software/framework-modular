import type { ProfileOption } from "../types";
import { Modal } from "./Modal";

interface Props {
  profile: ProfileOption | null;
  onCancel: () => void;
  /** `true`: añade también las filas sugeridas del perfil nuevo; `false`: solo cambia el perfil. */
  onApply: (addSuggestedQueues: boolean) => void;
}

/** Cambiar de perfil cuando ya hay trabajo hecho: nunca se borra nada, y la persona decide si quiere las sugerencias nuevas. */
export function ChangeProfileDialog({ profile, onCancel, onApply }: Props) {
  const suggested = profile?.suggestedQueues ?? [];
  const names = suggested.map((queue) => queue.name).join(", ");
  return (
    <Modal open={profile !== null} onClose={onCancel} labelledBy="nt-change-profile-title">
      <header className="nt-dialog-header">
        <div>
          <span className="nt-eyebrow">PERFIL DE TURNOS</span>
          <h2 id="nt-change-profile-title">Añadir otras filas sugeridas</h2>
        </div>
        <button type="button" className="nt-icon-button" aria-label="Cerrar cambio de perfil" onClick={onCancel}>
          ×
        </button>
      </header>
      <div className="nt-dialog-body">
        <p>
          El nuevo perfil es {profile?.name}. {suggested.length > 0 ? `Sugiere: ${names}.` : "Este perfil no trae filas sugeridas."}
        </p>
        <div className="nt-info-box">
          <p>Conservamos tus filas actuales, sus reglas y sus operadores. Puedes añadir las sugerencias de este perfil o cambiar solo el perfil.</p>
        </div>
      </div>
      <footer className="nt-dialog-footer nt-wrap">
        <button className="nt-secondary" type="button" onClick={() => onApply(false)}>
          Solo cambiar perfil
        </button>
        {suggested.length > 0 && (
          <button className="nt-primary" type="button" onClick={() => onApply(true)}>
            Añadir sugerencias
          </button>
        )}
      </footer>
    </Modal>
  );
}
