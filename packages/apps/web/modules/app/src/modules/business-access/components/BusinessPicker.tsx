import { observer } from "mobx-react-lite";
import { useId } from "react";
import { categoryLabel, type CategoryId } from "@/modules/businesses";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { businessInitials } from "../initials";
import { adminAccessStore } from "../stores/adminAccess.store";

/** Step 4, only for people who administer more than one business: just the ones the server authorized. */
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
      <p className="na-description">Tu correo tiene acceso a estos negocios. Elige a cuál quieres entrar.</p>
      <div className="na-business-picker">
        {store.businesses.map((business) => (
          <button
            key={business.id}
            type="button"
            className="na-business-choice"
            aria-label={`Entrar a ${business.name}`}
            disabled={store.busy}
            onClick={() => void store.openBusiness(business.id)}
          >
            <span className="na-business-avatar">{businessInitials(business.name)}</span>
            <div>
              <strong>{business.name}</strong>
              <span>{categoryLabel(business.category as CategoryId, business.categoryOther)}</span>
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
      <p className="na-picker-note">Esta selección solo aparece cuando administras más de un negocio.</p>
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
