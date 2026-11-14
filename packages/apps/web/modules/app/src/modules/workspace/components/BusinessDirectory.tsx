import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/elements/form/input";
import { Select } from "@/elements/form/select";
import {
  BusinessCard,
  BusinessDetailDialog,
  businessesStore,
  CATEGORIES,
  PAGE_SIZE,
  type Business,
  type BusinessStatus,
  type CategoryId,
} from "@/modules/businesses";
import { BusinessEmptyState } from "./BusinessEmptyState";

const SEARCH_DELAY_MS = 300;

const ALL = "all";
const INDUSTRY_OPTIONS = [{ value: ALL, label: "Todas las industrias" }, ...CATEGORIES.map((category) => ({ value: category.id, label: category.name }))];
const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "paused", label: "En pausa" },
];

interface BusinessDirectoryProps {
  onCreate: () => void;
  onReplay: () => void;
  onEdit: (business: Business) => void;
  onAnnounce: (message: string) => void;
}

/**
 * The directory of businesses: header with the count, filters and the list. With no businesses at all, the list
 * is the empty state that invites to create the first one. Filtering and paging are done by the service.
 */
export const BusinessDirectory = observer(({ onCreate, onReplay, onEdit, onAnnounce }: BusinessDirectoryProps) => {
  const store = businessesStore;
  const [selected, setSelected] = useState<Business | null>(null);
  const [searchText, setSearchText] = useState(store.filters.q);
  // The Select component is uncontrolled: a new key makes it show the cleared value.
  const [filterKey, setFilterKey] = useState(0);
  const searchTimer = useRef<number>();

  useEffect(() => {
    void store.load();
    return () => window.clearTimeout(searchTimer.current);
    // Loads once when the directory opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(value: string) {
    setSearchText(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => store.setFilters({ q: value }), SEARCH_DELAY_MS);
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current);
    setSearchText("");
    setFilterKey((key) => key + 1);
    store.clearFilters();
  }

  const loaded = store.state === "ready" || store.items.length > 0;
  const noBusinesses = store.state === "ready" && store.total === 0 && !store.hasFilters;
  const noMatches = store.state === "ready" && store.total === 0 && store.hasFilters;
  const filtersDisabled = !loaded || noBusinesses;
  const shown = store.items.length;
  const total = store.count ?? store.total;

  return (
    <section className="ws-directory" aria-labelledby="ws-directory-title">
      <header className="ws-directory-header">
        <h2 id="ws-directory-title">
          Todos los negocios <span>{total}</span>
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
          <Input
            type="search"
            name="search"
            placeholder="Buscar negocio, gerente o dirección…"
            value={searchText}
            onChange={(event) => handleSearch(event.target.value)}
            disabled={filtersDisabled}
            maxLength={100}
          />
        </label>
        <div className="ws-filter-select">
          <Select
            key={`industry-${filterKey}`}
            name="industry"
            aria-label="Industria"
            options={INDUSTRY_OPTIONS}
            defaultValue={store.filters.category || ALL}
            onChange={(value) => store.setFilters({ category: value === ALL ? "" : (value as CategoryId) })}
            disabled={filtersDisabled}
          />
        </div>
        <div className="ws-filter-select">
          <Select
            key={`status-${filterKey}`}
            name="status"
            aria-label="Estado"
            options={STATUS_OPTIONS}
            defaultValue={store.filters.status || ALL}
            onChange={(value) => store.setFilters({ status: value === ALL ? "" : (value as BusinessStatus) })}
            disabled={filtersDisabled}
          />
        </div>
        <p id="ws-filter-hint" className="ws-sr-only">
          {filtersDisabled
            ? "Los filtros estarán disponibles cuando haya negocios en este workspace."
            : "Filtra los negocios por nombre, jefe, dirección, industria o estado."}
        </p>
      </div>

      {store.state === "error" && store.items.length === 0 && (
        <div className="bs-state" role="alert">
          <p>{store.error}</p>
          <button type="button" onClick={() => void store.load()}>
            Intentar de nuevo
          </button>
        </div>
      )}
      {(store.state === "idle" || (store.state === "loading" && store.items.length === 0)) && (
        <p className="bs-loading" role="status">
          Cargando tus negocios…
        </p>
      )}
      {noBusinesses && <BusinessEmptyState onCreate={onCreate} onReplay={onReplay} />}
      {noMatches && (
        <div className="bs-state">
          <p>No encontramos negocios con esos filtros.</p>
          <button type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      )}
      {shown > 0 && (
        <>
          {store.state === "error" && (
            <p className="bs-error-banner" role="alert" style={{ margin: "18px 24px 0" }}>
              {store.error}{" "}
              <button type="button" className="bs-text-button" onClick={() => void store.load()}>
                Reintentar
              </button>
            </p>
          )}
          <div className={`ws-business-grid${store.state === "loading" ? " bs-business-grid-busy" : ""}`} aria-busy={store.state === "loading"}>
            {store.items.map((business) => (
              <BusinessCard key={business.id} business={business} onOpen={setSelected} />
            ))}
          </div>
          {store.pageCount > 1 && (
            <nav className="bs-pager" aria-label="Páginas del directorio">
              <button type="button" onClick={() => store.goToPage(store.page - 1)} disabled={store.page <= 1 || store.state === "loading"}>
                ← Anterior
              </button>
              <span>
                Página {store.page} de {store.pageCount}
              </span>
              <button type="button" onClick={() => store.goToPage(store.page + 1)} disabled={store.page >= store.pageCount || store.state === "loading"}>
                Siguiente →
              </button>
            </nav>
          )}
        </>
      )}

      <footer className="ws-directory-footer">
        <span>
          Mostrando <b>{shown}</b> de <b>{store.total}</b> negocios
          {store.pageCount > 1 ? ` (${PAGE_SIZE} por página)` : ""}
        </span>
        <span>Todo comienza con una conexión.</span>
      </footer>

      <BusinessDetailDialog
        business={selected}
        onClose={() => setSelected(null)}
        onEdit={onEdit}
        onChanged={(updated) => {
          store.replace(updated);
          setSelected(updated);
        }}
        onAnnounce={onAnnounce}
      />
    </section>
  );
});
