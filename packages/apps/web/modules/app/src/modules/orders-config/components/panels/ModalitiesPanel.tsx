import { observer } from "mobx-react-lite";
import { useState } from "react";
import { type ModalityType } from "../../types";
import { isOnSiteModeApplicable } from "../../validation";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";

export const ModalitiesPanel = observer(({ state, store }: { state: OrdersConfigState; store: OrdersConfigStore }) => {
  const [modalityFeedback, setModalityFeedback] = useState<string | null>(null);
  const handleToggleModality = (modality: ModalityType) => {
    const result = store.toggleModality(modality);
    if (!result.ok) {
      setModalityFeedback(result.message);
      return;
    }
    setModalityFeedback(null);
  };
  const showOnSiteMode = isOnSiteModeApplicable(state);

  return (
    <div>
      <h3 className="oc-section-title">Formas de entrega y atención</h3>
      <div className="oc-grid-3">
        {(
          [
            {
              id: "delivery",
              title: "Envío a domicilio",
              desc: "Entrega con mensajería propia urbana o transportadora nacional con guía.",
            },
            {
              id: "pickup",
              title: "Retiro en local",
              desc: "El cliente pasa a recoger personalmente su pedido listo.",
            },
            {
              id: "on_site",
              title: "En sitio / Mesa",
              desc: "Atención y consumo directo en tu establecimiento comercial.",
            },
          ] as const
        ).map((m) => {
          const isSelected = state.modalities.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={isSelected}
              className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => handleToggleModality(m.id)}
            >
              <strong>{m.title}</strong>
              <p>{m.desc}</p>
              <div className="oc-modality-status">
                {isSelected ? "✓ Habilitado" : "+ Habilitar"}
              </div>
            </button>
          );
        })}
      </div>
      {modalityFeedback && (
        <div className="oc-alert-warning" role="alert">
          <span>{modalityFeedback}</span>
        </div>
      )}

      {showOnSiteMode && (
        <div className="oc-section-block">
          <h3 className="oc-section-title">Atención en el establecimiento</h3>
          <div className="oc-grid-2">
            {(
              [
                {
                  id: "table_or_zone",
                  title: "Mesa o zona identificada",
                  desc: "Cada pedido se identifica con una mesa, habitación o zona de servicio.",
                },
                {
                  id: "counter",
                  title: "Barra o mostrador",
                  desc: "Los clientes solicitan y retiran directamente en barra o mostrador.",
                },
              ] as const
            ).map((option) => {
              const isSelected = state.onSiteMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => store.setOnSiteMode(option.id)}
                >
                  <strong>{option.title}</strong>
                  <p>{option.desc}</p>
                  <i>✓</i>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
