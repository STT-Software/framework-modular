import { observer } from "mobx-react-lite";
import { useState } from "react";
import { categoryLabel, type CategoryId } from "@/modules/businesses";
import { turnosStore } from "../stores/turnos.store";
import type { ProfileOption, TurnosProfileId } from "../types";
import { ChangeProfileDialog } from "./ChangeProfileDialog";
import { Icon } from "./Icon";
import { PROFILE_ICONS } from "./icons";

const suggestionsText = (profile: ProfileOption) =>
  profile.suggestedQueues.length > 0 ? `Filas sugeridas: ${profile.suggestedQueues.map((queue) => queue.name).join(" · ")}` : "Sin filas predeterminadas. Tú las creas.";

/** Paso 1: el perfil de atención. Parte del que se eligió en la configuración base (o el que sugiere la categoría). */
export const ProfilePanel = observer(() => {
  const store = turnosStore;
  const state = store.state;
  const [pending, setPending] = useState<ProfileOption | null>(null);
  if (!state) return null;
  const current = state.catalog.profiles.find((profile) => profile.id === state.profile.id) ?? state.catalog.profiles[state.catalog.profiles.length - 1];

  const apply = async (id: TurnosProfileId, add: boolean) => {
    setPending(null);
    const result = await store.changeProfile(id, add);
    store.announce(result.ok ? "Perfil actualizado. Tus filas y operadores se conservan." : result.message);
  };

  const choose = (profile: ProfileOption) => {
    if (profile.id === state.profile.id || store.saving) return;
    // Las sugerencias que nadie tocó se reemplazan; si hay trabajo de la persona, se le pregunta qué hacer con las del perfil nuevo.
    if (state.profile.suggestionsUntouched) void apply(profile.id, false);
    else setPending(profile);
  };

  return (
    <section className="nt-panel-enter" aria-label="Perfil de Turnos">
      <div className="nt-profile-banner">
        <span className="nt-badge">{categoryLabel(state.business.category as CategoryId, state.business.categoryOther)}</span>
        <p>Categoría registrada en la configuración base. El perfil de atención define las filas sugeridas para Turnos.</p>
      </div>
      <fieldset className="nt-profile-fieldset">
        <legend className="nt-sr-only">Perfil de atención de Turnos</legend>
        <div className="nt-profile-grid">
          {state.catalog.profiles.map((profile) => (
            <label key={profile.id} className="nt-profile-card">
              <input
                type="radio"
                name="nt-profile"
                value={profile.id}
                aria-label={profile.name}
                checked={state.profile.id === profile.id}
                disabled={store.saving}
                onChange={() => choose(profile)}
              />
              <span className="nt-profile-icon">
                <Icon paths={PROFILE_ICONS[profile.id]} />
              </span>
              <strong>{profile.name}</strong>
              <p>{profile.description}</p>
              <span className="nt-profile-suggestions">{suggestionsText(profile)}</span>
              <i>✓</i>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="nt-profile-note">
        <span>✦</span>
        <p>
          {current.suggestedQueues.length > 0
            ? "Puedes editar o eliminar cualquier fila sugerida y crear todas las que necesites."
            : "Tu perfil empieza sin filas. En el siguiente paso puedes crear la primera."}
        </p>
      </div>
      <ChangeProfileDialog profile={pending} onCancel={() => setPending(null)} onApply={(add) => pending && void apply(pending.id, add)} />
    </section>
  );
});
