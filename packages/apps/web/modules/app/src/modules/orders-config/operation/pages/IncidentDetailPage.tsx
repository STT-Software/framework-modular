import { Fragment, useState, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PhoneIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

import { PageMeta } from "@/shell/meta";
import { Button } from "@/elements/ui/button";
import type { IncidentStore } from "../stores/IncidentStore";
import {
  INCIDENT_STATUS_LABELS,
  canResolve,
  daysOpen,
  formatTime,
  incidentStatusClass,
  resolutionById,
  resolutionLabel,
  shortDate,
  type Incident,
  type ResolutionInput,
} from "../domain/incidentDomain";
import { carrierByName } from "../domain/carrierDirectory";
import { CarrierLogo } from "../components/CarrierLogo";
import { IncidentDialog } from "../components/IncidentDialog";

export interface IncidentDetailPageProps {
  trackingNumber: string;
  store: IncidentStore;
  linkedOrderStatusLabel?: string;
  hasLinkedOrder?: boolean;
  onBack: () => void;
  onOpenOrderDetail?: (orderNumber: string) => void;
  onOpenChat?: (phone: string) => void;
}

function formatRetryDate(iso: string | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return shortDate(parsed.toISOString());
}

function cleanOrderCode(orderNumber: string): string {
  return orderNumber.trim().replace(/^#/, "") || "—";
}

interface TarjetaResumenProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

const TarjetaResumen = ({ title, icon, children }: TarjetaResumenProps) => (
  <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {icon}
    </span>
  </div>
);

export const IncidentDetailPage = observer(
  ({
    trackingNumber,
    store,
    linkedOrderStatusLabel,
    hasLinkedOrder,
    onBack,
    onOpenOrderDetail,
    onOpenChat,
  }: IncidentDetailPageProps) => {
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const incidents = store.byTracking(trackingNumber);
    const latest = incidents[0];
    const oldest = incidents[incidents.length - 1];
    const activeIncident = activeIncidentId ? (store.byId(activeIncidentId) ?? null) : null;
    const resolvedHasLinkedOrder = hasLinkedOrder ?? Boolean(linkedOrderStatusLabel);

    const toggleExpanded = (id: string) => {
      setExpandedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    };

    const handleManage = (incident: Incident) => {
      store.openIncident(incident.id);
      setActiveIncidentId(incident.id);
    };

    const handleResolve = (id: string, data: ResolutionInput): string | null => {
      const result = store.resolveIncident(id, data);
      if (!result.ok) return result.error;

      setActiveIncidentId(null);
      const label = result.value.resolution
        ? (resolutionById(result.value.resolution)?.label ?? "")
        : "";
      setNotice(
        label
          ? `Novedad solucionada · ${label}`
          : "Novedad solucionada correctamente.",
      );
      window.setTimeout(() => setNotice(null), 4200);
      return null;
    };

    if (incidents.length === 0 || !latest || !oldest) {
      return (
        <>
          <PageMeta
            title={`Guía #${trackingNumber}`}
            description="Detalle de novedades por número de guía"
          />
          <div className="flex flex-col gap-4 font-sans">
            <div>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-theme-xs font-bold text-gray-600 shadow-2xs transition-colors hover:bg-gray-50 hover:text-ink-title cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
                Volver a novedades
              </button>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                <ExclamationTriangleIcon className="size-6" aria-hidden="true" />
              </span>
              <h1 className="text-base font-bold text-ink-title dark:text-white">
                No encontramos novedades para esta guía
              </h1>
              <p className="max-w-md text-theme-xs text-gray-500 dark:text-gray-400">
                La guía <span className="font-mono font-semibold">#{trackingNumber}</span> no tiene
                registros asociados en este negocio o ya fue retirada del historial.
              </p>
              <Button variant="outline" size="sm" onClick={onBack}>
                Volver a novedades
              </Button>
            </div>
          </div>
        </>
      );
    }

    const carrierInfo = carrierByName(latest.carrier);
    const pendingInTracking = incidents.filter((item) => canResolve(item)).length;
    const orderCode = cleanOrderCode(latest.orderNumber);

    return (
      <>
        <PageMeta
          title={`Guía #${trackingNumber}`}
          description={`Historial de novedades de la guía ${trackingNumber}`}
        />

        <div className="flex flex-col gap-5 font-sans">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-theme-xs font-bold text-gray-600 shadow-2xs transition-colors hover:bg-gray-50 hover:text-ink-title cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
                Volver a novedades
              </button>

              <h1 className="font-mono text-2xl font-bold tracking-tight text-ink-title dark:text-white">
                Guía #{trackingNumber}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-gray-400 dark:text-gray-500">Estado:</span>
                  <span
                    className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2.5 text-[10.5px] font-bold ${incidentStatusClass(
                      latest.status,
                    )}`}
                  >
                    {INCIDENT_STATUS_LABELS[latest.status]}
                  </span>
                  {linkedOrderStatusLabel && (
                    <span className="inline-flex h-5 items-center rounded-full bg-accent-100 px-2 text-[10.5px] font-bold text-ink-title dark:bg-accent-300/15 dark:text-accent-300">
                      {linkedOrderStatusLabel}
                    </span>
                  )}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-gray-400 dark:text-gray-500">Id:</span>
                  <span className="font-mono font-semibold text-ink-body dark:text-gray-200">
                    {latest.id}
                  </span>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className="font-mono font-semibold text-ink-body dark:text-gray-200">
                    Orden #{orderCode}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onOpenChat && latest.phone && (
                <button
                  type="button"
                  onClick={() => onOpenChat(latest.phone)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  <ChatBubbleLeftRightIcon className="size-4" aria-hidden="true" />
                  Abrir chat
                </button>
              )}

              {onOpenOrderDetail && (
                <button
                  type="button"
                  disabled={!resolvedHasLinkedOrder}
                  onClick={() => {
                    if (resolvedHasLinkedOrder) {
                      onOpenOrderDetail(latest.orderNumber);
                    }
                  }}
                  title={
                    resolvedHasLinkedOrder
                      ? `Abrir detalle de la orden #${orderCode}`
                      : "El pedido de esta guía no está en el tablero"
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 text-xs font-bold text-white shadow-theme-xs transition-colors hover:bg-gray-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:hover:bg-white"
                >
                  <span>Detalle de orden</span>
                  <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaResumen
              title="Cliente"
              icon={<UserIcon className="size-4.5" aria-hidden="true" />}
            >
              <p className="truncate text-theme-sm font-bold text-ink-body dark:text-white">
                {latest.customer}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                <PhoneIcon className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="truncate">{latest.phone}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-gray-500 dark:text-gray-400">
                <MapPinIcon className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="truncate">{latest.city}</span>
              </p>
            </TarjetaResumen>

            <TarjetaResumen
              title="Transportadora"
              icon={<TruckIcon className="size-4.5" aria-hidden="true" />}
            >
              <CarrierLogo carrier={carrierInfo} name={latest.carrier} size="md" />
              <p className="mt-2 truncate text-theme-sm font-bold text-ink-body dark:text-white">
                {latest.carrier}
              </p>
            </TarjetaResumen>

            <TarjetaResumen
              title="Días en novedad"
              icon={<ClockIcon className="size-4.5" aria-hidden="true" />}
            >
              <p className="font-mono text-lg font-bold tabular-nums text-ink-title dark:text-white">
                {daysOpen(oldest.createdAt)}
              </p>
              <p className="mt-1 text-[11.5px] text-gray-500 dark:text-gray-400">
                {incidents.length}{" "}
                {incidents.length === 1 ? "novedad registrada" : "novedades registradas"}
                {pendingInTracking > 0 ? ` · ${pendingInTracking} por gestionar` : ""}
              </p>
            </TarjetaResumen>

            <TarjetaResumen
              title="Última novedad"
              icon={<ExclamationTriangleIcon className="size-4.5" aria-hidden="true" />}
            >
              <span
                className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2.5 text-[10.5px] font-bold ${incidentStatusClass(
                  latest.status,
                )}`}
              >
                {INCIDENT_STATUS_LABELS[latest.status]}
              </span>
              <p className="mt-1.5 text-[12px] leading-snug text-gray-700 dark:text-gray-200">
                {latest.reason}
              </p>
            </TarjetaResumen>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
              <div>
                <h2 className="text-theme-sm font-bold text-ink-title dark:text-white">
                  Historial de novedades de la guía
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Ordenadas desde la más reciente hasta la primera reportada por la transportadora.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {incidents.length} {incidents.length === 1 ? "novedad" : "novedades"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.02]">
                    {[
                      "Id de novedad",
                      "Fecha de creación",
                      "Estado",
                      "Causal de novedad",
                      "Días en novedad",
                      "Solución",
                      "Detalles",
                      "Acción",
                    ].map((header) => (
                      <th
                        key={header}
                        className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500 ${
                          header === "Acción" ? "text-right" : ""
                        }`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((item) => {
                    const isExpanded = expandedIds.includes(item.id);
                    return (
                      <Fragment key={item.id}>
                        <tr className="border-b border-gray-100 transition-colors hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-gray-800/35">
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className="font-mono text-[11.5px] font-semibold text-ink-body dark:text-gray-200">
                              {item.id}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="text-theme-xs font-medium text-ink-body dark:text-gray-100">
                              {shortDate(item.createdAt)}
                            </div>
                            <div className="font-mono text-[10.5px] text-gray-400">
                              {formatTime(item.createdAt)}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[10.5px] font-bold ${incidentStatusClass(
                                item.status,
                              )}`}
                            >
                              {INCIDENT_STATUS_LABELS[item.status]}
                            </span>
                          </td>

                          <td className="max-w-[260px] px-4 py-3.5">
                            <p className="text-[12px] leading-snug text-gray-700 dark:text-gray-200">
                              {item.reason}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className="font-mono text-[11.5px] tabular-nums text-gray-600 dark:text-gray-300">
                              {daysOpen(item.createdAt)}
                            </span>
                          </td>

                          <td className="max-w-[220px] px-4 py-3.5">
                            {item.resolution ? (
                              <span className="text-[11.5px] font-medium text-ink-body dark:text-gray-200">
                                {resolutionLabel(item.resolution)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              aria-expanded={isExpanded}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-ink-body cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                              {isExpanded ? "Ocultar" : "Ver detalles"}
                              {isExpanded ? (
                                <ChevronUpIcon className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                              )}
                            </button>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5 text-right">
                            {canResolve(item) ? (
                              <button
                                type="button"
                                onClick={() => handleManage(item)}
                                className="inline-flex h-8 items-center rounded-lg border border-brand-500 px-3 text-[11.5px] font-bold text-brand-500 transition-colors hover:bg-brand-500 hover:text-white cursor-pointer"
                              >
                                Gestionar
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.02]">
                            <td colSpan={8} className="px-5 py-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                    <MapPinIcon className="size-3.5" aria-hidden="true" />
                                    Dirección y recepción
                                  </p>
                                  <dl className="mt-2 space-y-1.5 text-[11.5px]">
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-gray-400">Dirección original:</dt>
                                      <dd className="text-right font-semibold text-ink-body dark:text-gray-100">
                                        {item.address} ({item.city})
                                      </dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-gray-400">Quien recibe:</dt>
                                      <dd className="text-right font-medium text-ink-body dark:text-gray-200">
                                        {item.recipientName || "—"}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-gray-400">Teléfono de contacto:</dt>
                                      <dd className="text-right font-medium text-ink-body dark:text-gray-200">
                                        {item.recipientPhone || "—"}
                                      </dd>
                                    </div>
                                    {item.retryDate && (
                                      <div className="flex justify-between gap-3">
                                        <dt className="flex items-center gap-1 text-gray-400">
                                          <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                                          Fecha de reintento:
                                        </dt>
                                        <dd className="text-right font-medium text-ink-body dark:text-gray-200">
                                          {formatRetryDate(item.retryDate)}
                                        </dd>
                                      </div>
                                    )}
                                    {item.newAddress && (
                                      <div className="flex justify-between gap-3">
                                        <dt className="text-gray-400">Nueva dirección:</dt>
                                        <dd className="text-right font-medium text-ink-body dark:text-gray-200">
                                          {item.newAddress}
                                        </dd>
                                      </div>
                                    )}
                                    {item.newCity && (
                                      <div className="flex justify-between gap-3">
                                        <dt className="text-gray-400">Nuevo destino:</dt>
                                        <dd className="text-right font-medium text-ink-body dark:text-gray-200">
                                          {item.newCity}
                                        </dd>
                                      </div>
                                    )}
                                  </dl>
                                </div>

                                <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                    Observaciones y cierre
                                  </p>
                                  <p className="mt-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                                    {item.notes ||
                                      "Aún no se han registrado observaciones de solución."}
                                  </p>
                                  {item.resolvedAt && (
                                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                      <CheckCircleIcon className="size-3.5" aria-hidden="true" />
                                      Solucionada el {shortDate(item.resolvedAt)} a las{" "}
                                      {formatTime(item.resolvedAt)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-[11.5px] font-medium text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
              <span>
                {incidents.length} {incidents.length === 1 ? "novedad" : "novedades"} · Orden #
                {orderCode}
              </span>
              {pendingInTracking > 0 && (
                <span className="font-semibold text-brand-500">
                  {pendingInTracking}{" "}
                  {pendingInTracking === 1 ? "pendiente de gestión" : "pendientes de gestión"}
                </span>
              )}
            </footer>
          </div>
        </div>

        <IncidentDialog
          incident={activeIncident}
          onClose={() => setActiveIncidentId(null)}
          onResolve={handleResolve}
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
  },
);

export default IncidentDetailPage;
