import { categoryLabel, displayId, initialsOf } from "../catalog";
import type { Business } from "../types";
import { StatusBadge } from "./StatusBadge";

/** One business in the directory. */
export function BusinessCard({ business, onOpen }: { business: Business; onOpen: (business: Business) => void }) {
  const modules = business.modules.length;
  return (
    <article className="ws-business-card">
      <div className="ws-business-card-top">
        <span className="bs-business-avatar" aria-hidden="true">
          {initialsOf(business.name).slice(0, 1)}
        </span>
        <div>
          <p className="ws-business-category">{categoryLabel(business.category, business.categoryOther)}</p>
          <h3>{business.name}</h3>
        </div>
        <StatusBadge status={business.status} />
      </div>
      <p className="ws-business-address">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {business.address || "Dirección por completar"}
      </p>
      <div className="ws-business-meta">
        <div>
          Jefe de negocio
          <strong>{business.boss.name}</strong>
        </div>
        <span>{modules === 1 ? "1 módulo activo" : `${modules} módulos activos`}</span>
      </div>
      <div className="ws-business-card-footer">
        <span>{displayId(business.id)}</span>
        <button type="button" className="bs-text-button" aria-label={`Ver ficha de ${business.name}`} onClick={() => onOpen(business)}>
          Ver ficha completa →
        </button>
      </div>
    </article>
  );
}
