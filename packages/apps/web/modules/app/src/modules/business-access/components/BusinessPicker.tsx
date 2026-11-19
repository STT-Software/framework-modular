import { observer } from "mobx-react-lite";
import { useId } from "react";
import { categoryLabel, type CategoryId } from "@/modules/businesses";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { businessInitials } from "../initials";
import { adminAccessStore } from "../stores/adminAccess.store";

/**
 * Step 4, only for people with more than one access: a business in a role, just the ones the server authorized. The same email
 * can be the administrator of one business and an operator of another (or both in the same one), so the role is part of the choice.
 */
export const BusinessPicker = observer(() => {
  const store = adminAccessStore;
  const headingRef = useFocusHeading();
  const baseId = useId();

  return (
    <section className="na-view-enter" aria-labelledby={`${baseId}-title`}>
      <span className="na-eyebrow">
        <i />
        TUS ESPACIOS EN NECTO
      </span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        ¿Dónde comenzamos<span>?</span>
      </h1>
      <p className="na-description">Tu correo tiene acceso a estos negocios. Elige a cuál quieres entrar y con qué rol.</p>
      <div className="na-business-picker">
        {store.accesses.map((access) => (
          <button
            key={access.key}
            type="button"
            className="na-business-choice"
            aria-label={`Entrar a ${access.businessName}${access.role === "operator" ? " como operador" : " como administrador"}`}
            disabled={store.busy}
            onClick={() => void store.openAccess(access.key)}
          >
            <span className="na-business-avatar">{businessInitials(access.businessName)}</span>
            <div>
              <strong>{access.businessName}</strong>
              <span>
                {categoryLabel(access.category as CategoryId, access.categoryOther)} · {access.role === "operator" ? "Operador" : "Administrador"}
              </span>
            </div>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      {store.error && (
        <p className="na-error" role="alert">
          {store.error}
        </p>
      )}
      <p className="na-picker-note">Esta selección solo aparece cuando tienes más de un acceso (por negocio o por rol).</p>
      <button
        className="na-help-link"
        type="button"
        disabled={store.busy}
        onClick={() => void store.leave("Sesión cerrada. Verifica tu correo para volver a entrar.")}
      >
        Cerrar sesión
      </button>
    </section>
  );
});
