import { observer } from "mobx-react-lite";
import { useState } from "react";
import { ConfirmProfileSwitchModal } from "../../components/ConfirmProfileSwitchModal";
import { ORDERS_PROFILE_ICONS } from "../../components/icons";
import { PROFILE_DEFAULTS } from "../../constants";
import { type OrdersProfileId } from "../../types";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";

export const ProfilePanel = observer(({ state, store }: { state: OrdersConfigState; store: OrdersConfigStore }) => {
  const [pendingProfile, setPendingProfile] = useState<OrdersProfileId | null>(null);
  const handleProfileSelect = async (profId: OrdersProfileId) => {
    if (!store.state || store.saving || store.state.profile === profId) return;
    if (store.state.touched) {
      setPendingProfile(profId);
      return;
    }
    await store.setProfile(profId);
  };

  const handleConfirmProfileSwitch = async () => {
    if (!pendingProfile || store.saving) return;
    const target = pendingProfile;
    setPendingProfile(null);
    await store.setProfile(target, { force: true });
  };

  return (
    <>
    <div>
      <h3 className="oc-section-title">Selecciona el perfil principal</h3>
      <div className="oc-grid-2">
        {(["food", "fashion", "general", "services"] as OrdersProfileId[]).map((profId) => {
          const p = PROFILE_DEFAULTS[profId];
          const isSelected = state.profile === profId;
          return (
            <button
              key={profId}
              type="button"
              aria-pressed={isSelected}
              className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
              disabled={store.saving}
              onClick={() => void handleProfileSelect(profId)}
            >
              <span className="oc-profile-icon">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: ORDERS_PROFILE_ICONS[profId] }}
                />
              </span>
              <strong>{p.name}</strong>
              <p>{p.description}</p>
              <i>✓</i>
            </button>
          );
        })}
      </div>
    </div>
    <ConfirmProfileSwitchModal
      targetProfile={pendingProfile}
      onCancel={() => setPendingProfile(null)}
      onConfirm={() => void handleConfirmProfileSwitch()}
    />
    </>
  );
});
