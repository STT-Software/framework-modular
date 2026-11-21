import { observer } from "mobx-react-lite";
import { useState } from "react";
import { turnosStore } from "../stores/turnos.store";
import type { ProfileOption, TurnosProfileId } from "../types";
import { ChangeProfileDialog } from "./ChangeProfileDialog";
import { Icon } from "./Icon";
import { PROFILE_ICONS } from "./icons";

/** Paso 1: el perfil de atención. Parte del que se eligió en la configuración base (o el que sugiere la categoría). */
export const ProfilePanel = observer(() => {
  const store = turnosStore;
  const state = store.state;
  const [pending, setPending] = useState<ProfileOption | null>(null);
  if (!state) return null;

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
              <i>✓</i>
            </label>
          ))}
        </div>
      </fieldset>
      <ChangeProfileDialog profile={pending} onCancel={() => setPending(null)} onApply={(add) => pending && void apply(pending.id, add)} />
    </section>
  );
});
