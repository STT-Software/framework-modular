import { Input } from "@/elements/form/input";
import { Select } from "@/elements/form/select";
import { BusinessEmptyState } from "./BusinessEmptyState";

interface BusinessDirectoryProps {
  /** How many businesses the workspace has. Today there is no business data yet, so it is always 0. */
  businessCount: number;
  onCreate: () => void;
  onReplay: () => void;
}

const noop = () => undefined;

/**
 * The directory of businesses: header with the count, filters, and the list. The filters stay disabled
 * until there are businesses to filter; with none, the list is the empty state that invites to create one.
 */
export function BusinessDirectory({ businessCount, onCreate, onReplay }: BusinessDirectoryProps) {
  return (
    <section className="ws-directory" aria-labelledby="ws-directory-title">
      <header className="ws-directory-header">
        <h2 id="ws-directory-title">
          Todos los negocios <span>{businessCount}</span>
        </h2>
        <span className="ws-directory-note">
          <i aria-hidden="true" />
          Tu espacio para crecer
        </span>
      </header>

      <div className="ws-filterbar" aria-describedby="ws-filter-hint">
        <label className="ws-search">
          <span className="ws-sr-only">Buscar negocio, gerente o dirección</span>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <Input type="search" name="search" placeholder="Buscar negocio, gerente o dirección…" disabled />
        </label>
        <div className="ws-filter-select">
          <Select
            name="industry"
            aria-label="Industria"
            options={[{ value: "all", label: "Todas las industrias" }]}
            defaultValue="all"
            onChange={noop}
            disabled
          />
        </div>
        <div className="ws-filter-select">
          <Select
            name="status"
            aria-label="Estado"
            options={[{ value: "all", label: "Todos los estados" }]}
            defaultValue="all"
            onChange={noop}
            disabled
          />
        </div>
        <p id="ws-filter-hint" className="ws-sr-only">
          Los filtros estarán disponibles cuando haya negocios en este workspace.
        </p>
      </div>

      <BusinessEmptyState onCreate={onCreate} onReplay={onReplay} />

      <footer className="ws-directory-footer">
        <span>
          Mostrando <b>{businessCount}</b> de <b>{businessCount}</b> negocios
        </span>
        <span>Todo comienza con una conexión.</span>
      </footer>
    </section>
  );
}
