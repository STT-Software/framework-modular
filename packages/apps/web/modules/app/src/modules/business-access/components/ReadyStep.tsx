import { observer } from "mobx-react-lite";
import { useId } from "react";
import { categoryLabel, moduleInfo, type CategoryId } from "@/modules/businesses";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { businessInitials } from "../initials";
import { adminAccessStore } from "../stores/adminAccess.store";

/**
 * Step 5: the person is in. It shows the business the server authorized and the modules it has enabled; the
 * operation of each module is not part of this screen yet.
 */
export const ReadyStep = observer(() => {
  const store = adminAccessStore;
  const business = store.business;
  const headingRef = useFocusHeading();
  const baseId = useId();
  if (!business) return null;

  return (
    <section className="na-view-enter" aria-labelledby={`${baseId}-title`}>
      <div className="na-ready-icon" aria-hidden="true">
        <svg viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" />
          <path d="m17 28 8 8 15-17" />
        </svg>
      </div>
      <span className="na-eyebrow">
        <i />
        UNA NUEVA JORNADA
      </span>
      <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1}>
        Ya estás
        <br />
        en tu negocio<span>.</span>
      </h1>
      <p className="na-description">Todo listo para seguir conectando, compartiendo y creciendo.</p>
      <div className="na-ready-business">
        <div>
          <span className="na-business-avatar" aria-hidden="true">
            {businessInitials(business.name)}
          </span>
          <div>
            <strong>{business.name}</strong>
            <span>{categoryLabel(business.category as CategoryId, business.categoryOther)}</span>
          </div>
          <span className="na-role-badge">Administrador</span>
        </div>
        <p>{store.email}</p>
        <div className="na-ready-modules">
          {business.modules.length === 0 ? (
            <span>Sin módulos habilitados todavía</span>
          ) : (
            business.modules.map((id) => <span key={id}>{moduleInfo(id)?.name ?? id}</span>)
          )}
        </div>
      </div>
      <div className="na-ready-device">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="13" rx="2" />
          <path d="M2 20h20m-13-4-1 4m7-4 1 4" />
        </svg>
        <span>{store.remember ? "Elegiste recordar este dispositivo personal durante 30 días." : "Acceso verificado para esta sesión."}</span>
      </div>
      {store.businesses.length > 1 && (
        <button type="button" className="na-secondary" onClick={() => store.backToBusinesses()}>
          Cambiar de negocio
        </button>
      )}
      <button
        type="button"
        className="na-help-link"
        disabled={store.busy}
        onClick={() => void store.leave("Sesión cerrada. Verifica tu correo para volver a entrar.")}
      >
        Cerrar sesión
      </button>
    </section>
  );
});
