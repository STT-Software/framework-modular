import { observer } from "mobx-react-lite";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { categoryLabel, type CategoryId } from "@/modules/businesses";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { adminAccessStore } from "../stores/adminAccess.store";

type ChoiceStatus = "idle" | "loading" | "success";

/**
 * Step 4, only for people with more than one access: a business in a role, just the ones the server authorized.
 * Clean, elevated NECTO selector cards that distinguish between Business Admin and Operator roles.
 */
export const BusinessPicker = observer(() => {
  const store = adminAccessStore;
  const headingRef = useFocusHeading();
  const baseId = useId();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [choiceStatus, setChoiceStatus] = useState<ChoiceStatus>("idle");

  const handleSelect = async (key: string) => {
    if (store.busy || choiceStatus !== "idle") return;
    setSelectedKey(key);
    setChoiceStatus("loading");
    try {
      const minSpin = new Promise((resolve) => setTimeout(resolve, 350));
      await Promise.all([store.openAccess(key), minSpin]);
      setChoiceStatus("success");
    } catch {
      setSelectedKey(null);
      setChoiceStatus("idle");
    }
  };

  return (
    <section className="na-view-enter" aria-labelledby={`${baseId}-title`}>
      <span className="na-eyebrow">
        <i />
        TUS ESPACIOS EN NECTO
      </span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        ¿Dónde comenzamos<span>?</span>
      </h1>
      <p className="na-description">
        Tu correo tiene acceso a estos negocios. Elige a cuál quieres entrar y con qué rol.
      </p>

      <div className="na-business-picker">
        {store.accesses.map((access) => {
          const isOperator = access.role === "operator";
          const isSelected = selectedKey === access.key;
          const isDimmed = selectedKey !== null && !isSelected;
          const status = isSelected ? choiceStatus : "idle";

          return (
            <button
              key={access.key}
              type="button"
              className={`na-business-card ${isOperator ? "is-operator" : "is-admin"}${
                isDimmed ? " is-dimmed" : ""
              }${status === "loading" ? " is-loading" : ""}${status === "success" ? " is-success" : ""}`}
              aria-label={`Entrar a ${access.businessName} como ${isOperator ? "operador" : "administrador"}`}
              disabled={store.busy || choiceStatus !== "idle"}
              onClick={() => void handleSelect(access.key)}
            >
              <div className={`na-card-icon-wrap ${isOperator ? "is-operator" : "is-admin"}`}>
                {isOperator ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="na-icon-svg">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="na-icon-svg">
                    <path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M11 11h2M11 15h2M16 11h2M16 15h2M2 7l10-4 10 4" />
                  </svg>
                )}
              </div>

              <div className="na-card-body">
                <div className="na-card-top-row">
                  <span className="na-card-business-name">{access.businessName}</span>
                  <span className={`na-role-badge ${isOperator ? "na-role-operator" : "na-role-admin"}`}>
                    <i className="na-badge-dot" />
                    {isOperator ? "Operador" : "Administrador"}
                  </span>
                </div>

                <h3 className="na-card-title">
                  {isOperator ? "Atención y Turnos" : "Gestión y Configuración"}
                </h3>

                <p className="na-card-desc">
                  {categoryLabel(access.category as CategoryId, access.categoryOther)} ·{" "}
                  {isOperator
                    ? "Control de filas, llamado de tickets y atención."
                    : "Módulos, catálogo, inventario y administración general."}
                </p>
              </div>

              <div className="na-card-action" aria-hidden="true">
                {status === "loading" ? (
                  <svg viewBox="0 0 24 24" className="na-action-spinner">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke={isOperator ? "#0e7090" : "#190088"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="14 42"
                      fill="none"
                    />
                  </svg>
                ) : status === "success" ? (
                  <svg viewBox="0 0 24 24" className="na-action-check">
                    <circle cx="12" cy="12" r="10" fill="#ecfdf3" stroke="#12b76a" strokeWidth="1.5" />
                    <path
                      d="m8 12 3 3 5-6"
                      stroke="#12b76a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <div className="na-action-circle">
                    <svg viewBox="0 0 20 20" className="na-action-arrow">
                      <path
                        d="M4.167 10h11.666m-5-5 5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="na-picker-note">
        Esta selección solo aparece cuando tienes más de un acceso (por negocio o por rol).
      </p>
    </section>
  );
});
