import { useState } from "react";
import { observer } from "mobx-react-lite";

import {
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

import { PageMeta } from "@/shell/meta";
import type { IncidentStore } from "../stores/IncidentStore";
import {
    INCIDENT_STATUSES,
    INCIDENT_STATUS_LABELS,
    incidentStatusClass,
    daysOpen,
    shortDate,
    filterIncidents,
    formatTime,
    canResolve,
    resolutionById,
    type IncidentStatus,
    type Incident,
} from "../domain/incidentDomain";
import { IncidentDialog } from "../components/IncidentDialog";
import { CarrierLogo } from "../components/CarrierLogo";
import { carrierByName } from "../domain/carrierDirectory";

export const IncidentsPage = observer(({ store: incidentStore, activeIncidentId, setActiveIncidentId }: { store: IncidentStore; activeIncidentId?: string; setActiveIncidentId: (id: string | null) => void }) => {

  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const incidents = filterIncidents(incidentStore.incidents, { statuses, search });
  const currentIncident = activeIncidentId ? (incidentStore.byId(activeIncidentId) ?? null) : null;

  const hasFilters = statuses.length > 0 || search.trim().length > 0;

  const toggleStatus = (status: IncidentStatus) => {
    setStatuses((prev) =>
      prev.includes(status) ? prev.filter((e) => e !== status) : [...prev, status],
    );
  };

  const resetFilters = () => {
    setStatuses([]);
    setText("");
    setSearch("");
    setMenuOpen(false);
  };

  const openIncident = (n: Incident) => {

    incidentStore.openIncident(n.id);
    setActiveIncidentId(n.id);
  };

  const resolveIssue = (id: string, data: Parameters<typeof incidentStore.resolveIncident>[1]) => {
    const res = incidentStore.resolveIncident(id, data);
    if (!res.ok) return res.error;

    setActiveIncidentId(null);
    setNotice(`Novedad solucionada · ${resolutionById(res.value.resolution!)?.label ?? ""}`);
    window.setTimeout(() => setNotice(null), 4200);
    return null;
  };

  const counts: Record<string, number> = {};
  for (const n of incidentStore.incidents) counts[n.status] = (counts[n.status] ?? 0) + 1;

  return (
    <>
      <PageMeta
        title="Gestión de novedades"
        description="Da solución a las novedades presentadas con tus pedidos"
      />

      <div className="flex flex-col gap-4 font-sans">

        <header>
          <h1 className="text-2xl font-bold tracking-tight text-ink-title dark:text-white">
            Gestión de novedades
          </h1>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            En este panel puedes dar solución a las novedades presentadas con tus pedidos.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-theme-xs font-medium shadow-theme-xs transition-colors cursor-pointer select-none ${
                statuses.length > 0
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "border-gray-200/90 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700/80 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <FunnelIcon className="size-3.5" />
              Estados
              {statuses.length > 0 && (
                <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-brand-500 text-[9.5px] font-bold text-white">
                  {statuses.length}
                </span>
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute left-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-gray-100 bg-white py-1.5 shadow-theme-lg animate-entrada-menu dark:border-gray-800 dark:bg-gray-900"
                >
                  {INCIDENT_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={statuses.includes(status)}
                      onClick={() => toggleStatus(status)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-theme-xs text-ink-body transition-colors hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          statuses.includes(status)
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {statuses.includes(status) && <CheckCircleIcon className="size-3" />}
                      </span>
                      <span className="flex-1">{INCIDENT_STATUS_LABELS[status]}</span>
                      <span className="font-mono text-[10px] text-gray-400">
                        {counts[status] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {statuses.map((status) => (
            <span
              key={status}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200/90 bg-white px-3 text-theme-xs font-medium text-gray-800 shadow-theme-xs dark:border-gray-700/80 dark:bg-gray-900/80 dark:text-gray-200"
            >
              Estado: {INCIDENT_STATUS_LABELS[status]}
              <button
                type="button"
                onClick={() => toggleStatus(status)}
                aria-label={`Quitar el filtro ${INCIDENT_STATUS_LABELS[status]}`}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer dark:hover:text-white"
              >
                <XMarkIcon className="size-3.5 stroke-[2.5]" />
              </button>
            </span>
          ))}

          {search.trim() && (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200/90 bg-white px-3 text-theme-xs font-medium text-gray-800 shadow-theme-xs dark:border-gray-700/80 dark:bg-gray-900/80 dark:text-gray-200">
              Orden: {search}
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setText("");
                }}
                aria-label="Quitar el filtro por orden"
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer dark:hover:text-white"
              >
                <XMarkIcon className="size-3.5 stroke-[2.5]" />
              </button>
            </span>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 rounded-xl px-2 text-theme-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-ink-body cursor-pointer dark:text-gray-400 dark:hover:text-white"
            >
              Limpiar filtros
            </button>
          )}

          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(text.trim());
            }}
          >
            <div className="relative flex items-center">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 size-4 text-gray-400" />
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Búsqueda por N.º de la orden"
                aria-label="Buscar por número de la orden"
                className="h-10 w-56 rounded-xl border border-gray-200/90 bg-white pl-9 pr-3 text-theme-xs text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 sm:w-64 dark:border-gray-700/80 dark:bg-gray-900/80 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-xl bg-brand-500 px-4 text-theme-xs font-bold text-white shadow-theme-xs transition-colors hover:bg-brand-600 cursor-pointer"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Restablecer filtros"
              title="Restablecer filtros"
              className="flex size-10 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700/80 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowPathIcon className="size-4" />
            </button>
          </form>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.02]">
                {[
                  "Carrier",
                  "Cliente",
                  "Fecha de creación",
                  "Orden",
                  "Estado",
                  "Causal de novedad",
                  "Días en novedad",
                  "Solución",
                  "",
                ].map((c, i) => (
                  <th
                    key={c + i}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((n) => (
                <tr
                  key={n.id}

                  onClick={() => openIncident(n)}
                  className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-gray-800/40"
                >

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CarrierLogo
                        carrier={carrierByName(n.carrier)}
                        name={n.carrier}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-theme-xs font-bold text-ink-body dark:text-gray-100">
                          {n.carrier}
                        </div>
                        <div className="font-mono text-[10.5px] text-gray-400">Guía {n.trackingNumber}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-theme-xs font-medium text-ink-body dark:text-gray-200">
                      {n.customer}
                    </div>
                    <div className="text-[10.5px] text-gray-400">{n.phone}</div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-theme-xs text-ink-body dark:text-gray-200">
                      {shortDate(n.createdAt)}
                    </div>
                    <div className="font-mono text-[10.5px] text-gray-400">
                      {formatTime(n.createdAt)}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="font-mono text-[11.5px] text-ink-body dark:text-gray-200">
                      {n.orderNumber}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[10.5px] font-bold ${
                        incidentStatusClass(n.status)
                      }`}
                    >
                      {INCIDENT_STATUS_LABELS[n.status]}
                    </span>
                  </td>

                  <td className="max-w-[240px] px-4 py-3">
                    <span className="text-[11.5px] leading-snug text-gray-600 dark:text-gray-300">
                      {n.reason}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-[11px] tabular-nums text-gray-600 dark:text-gray-300">
                      {daysOpen(n.createdAt)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {n.resolution ? (
                      <span className="text-[11.5px] font-medium text-ink-body dark:text-gray-200">
                        {resolutionById(n.resolution)?.label ?? "—"}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {canResolve(n) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openIncident(n);
                        }}
                        className="inline-flex h-8 items-center rounded-lg border border-brand-500 px-3 text-[11.5px] font-bold text-brand-500 transition-colors hover:bg-brand-500 hover:text-white cursor-pointer"
                      >
                        Gestionar
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {incidents.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <ExclamationTriangleIcon className="size-6 text-gray-300 dark:text-gray-600" />
              <p className="text-theme-sm font-bold text-ink-title dark:text-white">
                No hay novedades con estos filtros
              </p>
              <p className="max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
                {search
                  ? `Ninguna novedad coincide con «${search}». Revisa el número de la orden.`
                  : "Ninguna novedad está en los estados seleccionados."}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-1 h-9 rounded-xl border border-gray-200 px-3 text-theme-xs font-bold text-ink-body transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {incidents.length} de {incidentStore.incidents.length} novedades ·{" "}
          {incidentStore.pendingCount} esperando decisión
        </p>
      </div>

      <IncidentDialog
        incident={currentIncident}
        onClose={() => setActiveIncidentId(null)}
        onResolve={resolveIssue}
      />

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-theme-xs text-ink-body shadow-theme-lg animate-entrada-aviso dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
            <CheckCircleIcon className="size-4 text-success-500" />
            {notice}
          </div>
        </div>
      )}
    </>
  );
});

export default IncidentsPage;
