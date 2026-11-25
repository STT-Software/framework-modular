import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ArrowsUpDownIcon,
    CheckIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    TruckIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

import { PageMeta } from "@/shell/meta";
import { Input } from "@/elements/form/input";
import type { PickupStore } from "../stores/PickupStore";
import {
    PICKUP_STATUS_LABELS,
    PICKUP_STATUSES,
    filterPickups,
    type RecurringPickupInput,
    type PickupInput,
    type PickupStatus,
    type Pickup,
    type PickupType,
} from "../domain/pickupDomain";
import { CARRIERS, carrierByName } from "../domain/carrierDirectory";
import { Modal } from "../components/Dialog";
import { Button } from "@/elements/ui/button";
import { PlusIcon } from "@/icons";
import { field } from "../pickupFields";
import { appointmentsCsv, recurringCsv, pickupFilename } from "../pickupCsv";
import { downloadCsv } from "../csv";
import { RecurringPickupCard } from "../components/RecurringPickupCard";
import { PickupSettings } from "../components/PickupSettings";

const TYPES: { key: PickupType; label: string }[] = [
  { key: "occasional", label: "Eventual" },
  { key: "recurring", label: "Fija" },
];

const EMPTY_FILTERS = "¡Ups! Aún no tienes recolecciones, revisa los filtros";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "—";
  const [, year, month, day] = m;
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ""} ${year}`;
}

const STATUS_STYLE: Record<PickupStatus, string> = {
  scheduled: "bg-[#EFE6D3] text-[#212121] dark:bg-[#EFE6D3]/15 dark:text-[#EFE6D3]",
  assigned: "bg-[#97D6DF]/25 text-[#190088] dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]",
  incident: "bg-[#FF3F1A]/10 text-[#FF3F1A] dark:bg-[#FF3F1A]/15 dark:text-[#FF3F1A]",
};

const STATUS_DOT: Record<PickupStatus, string> = {
  scheduled: "bg-[#212121]/40",
  assigned: "bg-[#190088]",
  incident: "bg-[#FF3F1A]",
};

const EMPTY_FORM = (): PickupInput => ({
  kind: "occasional",
  carrier: "",
  warehouse: "",
  date: "",
  timeSlot: "",
  packages: "",
  dispatcher: "",
});

const EMPTY_SETTINGS = (carrier = ""): RecurringPickupInput => ({
  carrier,
  days: [],
  warehouse: "",
  address: "",
  dispatcherFirstName: "",
  dispatcherLastName: "",
  slot: "morning",
  packages: "",
  notes: "",
});

const PILL =
  "inline-flex h-10 shrink-0 select-none items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-3 text-theme-xs font-medium text-[#212121] shadow-theme-xs transition-colors hover:bg-[#ECECEC]/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85 dark:hover:bg-white/[0.07] cursor-pointer";

const ICON_BUTTON =
  "flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#ECECEC] bg-white text-[#212121] shadow-theme-xs transition-colors hover:bg-[#ECECEC]/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85 dark:hover:bg-white/[0.07] cursor-pointer";

const CHIP =
  "inline-flex h-10 select-none items-center gap-1.5 rounded-xl border border-[#FF3F1A]/45 bg-white px-3 text-theme-xs font-bold text-[#FF3F1A] dark:bg-[#FF3F1A]/10";

const MENU_ITEM = "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-theme-xs transition-colors cursor-pointer";

const EmptyIllustration = () => (
  <svg
    viewBox="0 0 160 120"
    className="h-28 w-40 text-[#ECECEC] dark:text-white/15"
    fill="none"
    aria-hidden="true"
  >
    <rect x="52" y="18" width="56" height="52" rx="6" stroke="currentColor" strokeWidth="2.5" />
    <path d="M64 34h32M64 44h22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M30 34h14M24 44h20" stroke="#97D6DF" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="38" y="80" width="84" height="18" rx="9" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="118" cy="26" r="3" fill="#FF3F1A" />
  </svg>
);

const PickupRow = ({ pickup: r }: { pickup: Pickup }) => {
  const carrier = carrierByName(r.carrier);
  return (
    <tr className="transition-colors hover:bg-[#F9F9F8] dark:hover:bg-white/[0.03]">
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {carrier?.logo ? (
            <img src={carrier.logo} alt="" className="h-4 max-w-[54px] object-contain" />
          ) : (
            <span className="size-1.5 rounded-full bg-[#97D6DF]" aria-hidden="true" />
          )}
          <span className="font-bold text-[#212121] dark:text-white">{r.carrier}</span>
        </div>
      </td>
      <td className="px-4 py-4 font-mono font-semibold tabular-nums text-[#190088] dark:text-[#97D6DF]">
        {r.code}
      </td>
      <td className="px-4 py-4 font-normal text-[#212121]/80 dark:text-white/70">{r.warehouse}</td>
      <td className="px-4 py-4 whitespace-nowrap font-normal text-[#212121]/80 dark:text-white/70">
        {formatDate(r.date)}
      </td>
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[r.status]}`}
        >
          <span className={`size-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
          {PICKUP_STATUS_LABELS[r.status]}
        </span>
      </td>
      <td className="px-4 py-4 tabular-nums font-normal text-[#212121]/80 dark:text-white/70">
        {r.packages}
      </td>
      <td className="px-4 py-4 whitespace-nowrap font-normal text-[#212121]/80 dark:text-white/70">
        {r.timeSlot}
      </td>
      <td className="px-4 py-4 font-normal text-[#212121]/80 dark:text-white/70">{r.dispatcher}</td>
    </tr>
  );
};

export const CarriersPage = observer(({ store: pickupStore }: { store: PickupStore }) => {
  const [kind, setType] = useState<PickupType>("occasional");
  const [statuses, setStatuses] = useState<PickupStatus[]>([]);
  const [carrier, setCarrier] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState<"statuses" | "carrier" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [descending, setDescending] = useState(false);
  const [formData, setFormData] = useState<PickupInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingSettings, setEditingSettings] = useState<{
    id?: string;
    data: RecurringPickupInput;
  } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const isRecurring = kind === "recurring";

  const query = search.trim().toLocaleLowerCase("es");
  const matches = (fields: (string | number | undefined)[]) =>
    !query || fields.join(" ").toLocaleLowerCase("es").includes(query);

  const filteredAppointments = filterPickups(pickupStore.pickups, {
    kind: "occasional",
    statuses,
    carrier,
  }).filter((r) => matches([r.code, r.carrier, r.warehouse, r.dispatcher, r.timeSlot]));

  const appointments = descending ? [...filteredAppointments].reverse() : filteredAppointments;

  const recurring = pickupStore.schedules
    .filter((c) => !carrier || c.carrier === carrier)
    .filter((c) =>
      matches([c.carrier, c.warehouse, c.address, c.dispatcherFirstName, c.dispatcherLastName]),
    );

  const hasFilters = statuses.length > 0 || carrier !== null || query.length > 0;

  const toggleStatus = (status: PickupStatus) =>
    setStatuses((prev) => (prev.includes(status) ? prev.filter((e) => e !== status) : [...prev, status]));

  const clearFilters = () => {
    setStatuses([]);
    setCarrier(null);
    setSearch("");
  };

  const downloadFile = () => {
    if (isRecurring) {
      downloadCsv(recurringCsv(recurring), pickupFilename("recurring"));
      return;
    }
    downloadCsv(appointmentsCsv(appointments), pickupFilename("occasional"));
  };

  const countStatus = (status: PickupStatus) =>
    pickupStore.pickups.filter((r) => r.kind === "occasional" && r.status === status).length;

  const openForm = () => {
    setError(null);
    setFormData(EMPTY_FORM());
  };

  const save = () => {
    if (!formData) return;
    const result = pickupStore.create(formData);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormData(null);
    setError(null);
  };

  const openSettings = (id?: string) => {
    setSettingsError(null);
    const existing = id ? pickupStore.schedules.find((c) => c.id === id) : undefined;
    setEditingSettings({
      id,
      data: existing
        ? {
            carrier: existing.carrier,
            days: [...existing.days],
            warehouse: existing.warehouse,
            address: existing.address,
            dispatcherFirstName: existing.dispatcherFirstName,
            dispatcherLastName: existing.dispatcherLastName,
            slot: existing.slot,
            packages: String(existing.packages),
            notes: existing.notes,
          }
        : EMPTY_SETTINGS(carrier ?? ""),
    });
  };

  const saveSchedule = (data: RecurringPickupInput) => {
    const result = pickupStore.saveSchedule(data, editingSettings?.id);
    if (!result.ok) {
      setSettingsError(result.error);
      return;
    }

    setType("recurring");
    setEditingSettings(null);
    setSettingsError(null);
  };

  if (editingSettings) {
    return (
      <div className="flex w-full flex-col gap-5 font-sans">
        <PageMeta
          title="Configurar Recogida"
          description="Días, bodega y datos de quien despacha de una recolección fija"
        />
        <PickupSettings
          key={editingSettings.id ?? "newSchedule"}
          initial={editingSettings.data}
          editing={Boolean(editingSettings.id)}
          error={settingsError}
          onEdit={() => setSettingsError(null)}
          onCancel={() => {
            setEditingSettings(null);
            setSettingsError(null);
          }}
          onSave={saveSchedule}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 font-sans">
      <PageMeta
        title="Transportadoras"
        description="Recolecciones de tus pedidos con cada transportadora"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#190088] lg:text-title-md dark:text-white">
            Transportadoras
          </h1>
          <p className="mt-1 max-w-2xl text-theme-sm font-light text-[#212121]/70 dark:text-white/60">
            En este módulo podrás gestionar las recolecciones de tus pedidos con cada transportadora.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (isRecurring ? openSettings() : openForm())}
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#FF3F1A] px-4 text-theme-sm font-bold text-white transition-colors hover:bg-[#FF3F1A]/90 cursor-pointer"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          {isRecurring ? "Configurar recolección" : "Nueva recolección"}
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-[#ECECEC] dark:border-white/10">
        {TYPES.map((t) => {
          const active = kind === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              aria-pressed={active}
              className={`-mb-px rounded-t-xl border border-b-0 px-5 py-2 text-theme-xs font-bold transition-colors cursor-pointer ${
                active
                  ? "border-[#ECECEC] bg-white text-[#FF3F1A] dark:border-white/10 dark:bg-gray-900 dark:text-[#FF3F1A]"
                  : "border-transparent text-[#212121]/55 hover:text-[#212121] dark:text-white/50 dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {searchOpen && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Transportadora, bodega, código…"
            className="h-10 w-48 shrink-0 sm:w-64"
            aria-label="Buscar recolecciones"
          />
        )}

        <button
          type="button"
          onClick={() => {
            if (searchOpen) setSearch("");
            setSearchOpen((v) => !v);
          }}
          aria-expanded={searchOpen}
          aria-label={searchOpen ? "Ocultar el buscador" : "Buscar recolecciones"}
          title={searchOpen ? "Ocultar el buscador" : "Buscar recolecciones"}
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
            searchOpen
              ? "border-[#212121]/25 bg-[#ECECEC] text-[#212121] dark:border-white/25 dark:bg-white/15 dark:text-white"
              : "border-[#ECECEC] bg-white text-[#212121] shadow-theme-xs hover:bg-[#ECECEC]/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85 dark:hover:bg-white/[0.07]"
          }`}
        >
          <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setStatuses((prev) => [...prev])}
          aria-label="Volver a leer las recolecciones"
          title="Volver a leer las recolecciones"
          className={ICON_BUTTON}
        >
          <ArrowPathIcon className="size-4" aria-hidden="true" />
        </button>

        {!isRecurring && (
          <div className="relative inline-block shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => (v === "statuses" ? null : "statuses"))}
              aria-expanded={menuOpen === "statuses"}
              aria-haspopup="true"
              className={PILL}
            >
              <FunnelIcon className="size-3.5 text-[#212121]/50 dark:text-white/50" aria-hidden="true" />
              <span>Estados</span>
              {statuses.length > 0 && (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-[#FF3F1A] text-[10px] font-bold text-white">
                  {statuses.length}
                </span>
              )}
            </button>

            {menuOpen === "statuses" && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-[#ECECEC] bg-white p-1.5 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-gray-900">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#212121]/40 dark:text-white/40">
                  Filtrar por estado
                </div>
                {PICKUP_STATUSES.map((status) => {
                  const checked = statuses.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className={`${MENU_ITEM} ${
                        checked
                          ? "bg-[#ECECEC]/70 font-bold text-[#212121] dark:bg-white/10 dark:text-white"
                          : "text-[#212121]/75 hover:bg-[#ECECEC]/40 dark:text-white/70 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex size-4 items-center justify-center rounded border ${
                            checked
                              ? "border-[#FF3F1A] bg-[#FF3F1A] text-white"
                              : "border-[#212121]/25 dark:border-white/25"
                          }`}
                        >
                          {checked && <CheckIcon className="size-3 stroke-[3]" aria-hidden="true" />}
                        </span>
                        {PICKUP_STATUS_LABELS[status]}
                      </span>
                      <span className="text-[11px] font-medium text-[#212121]/35 dark:text-white/35">
                        {countStatus(status)}
                      </span>
                    </button>
                  );
                })}

                {hasFilters && (
                  <>
                    <div className="my-1 border-t border-[#ECECEC] dark:border-white/10" />
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="flex w-full items-center justify-center rounded-lg py-1 text-[11px] font-medium text-[#212121]/50 hover:bg-[#ECECEC]/40 hover:text-[#FF3F1A] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-[#FF3F1A] cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {!isRecurring && (
          <button
            type="button"
            onClick={() => setDescending((v) => !v)}
            title={descending ? "Orden: fecha más lejana primero" : "Orden: fecha más próxima primero"}
            aria-label={descending ? "Orden: fecha más lejana primero" : "Orden: fecha más próxima primero"}
            className={PILL}
          >
            <ArrowsUpDownIcon className="size-3.5 text-[#212121]/50 dark:text-white/50" aria-hidden="true" />
            <span>Ordenar</span>
          </button>
        )}

        <div className="relative inline-block shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => (v === "carrier" ? null : "carrier"))}
            aria-expanded={menuOpen === "carrier"}
            aria-haspopup="true"
            className={PILL}
          >
            <TruckIcon className="size-3.5 text-[#212121]/50 dark:text-white/50" aria-hidden="true" />
            <span>Transportadora</span>
            {carrier && (
              <span className="flex size-4.5 items-center justify-center rounded-full bg-[#FF3F1A] text-[10px] font-bold text-white">
                1
              </span>
            )}
          </button>

          {menuOpen === "carrier" && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-[#ECECEC] bg-white p-1.5 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-gray-900">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#212121]/40 dark:text-white/40">
                Filtrar por transportadora
              </div>
              {CARRIERS.map((t) => {
                const enabled = carrier === t.name;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCarrier(enabled ? null : t.name)}
                    className={`${MENU_ITEM} ${
                      enabled
                        ? "bg-[#ECECEC]/70 font-bold text-[#212121] dark:bg-white/10 dark:text-white"
                        : "text-[#212121]/75 hover:bg-[#ECECEC]/40 dark:text-white/70 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {t.logo ? (
                        <img src={t.logo} alt="" className="h-3.5 max-w-[44px] object-contain" />
                      ) : (
                        <span className="size-3.5 rounded-full border border-[#ECECEC] dark:border-white/20" />
                      )}
                      {t.name}
                    </span>
                    {enabled && <CheckIcon className="size-3.5 text-[#FF3F1A]" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={downloadFile}
          title={isRecurring ? "Descargar las recolecciones fijas (CSV)" : "Descargar las recolecciones (CSV)"}
          className={PILL}
        >
          <ArrowDownTrayIcon className="size-3.5 text-[#212121]/50 dark:text-white/50" aria-hidden="true" />
          <span>Descargar</span>
        </button>

        {hasFilters && <div className="mx-0.5 h-4 w-px bg-[#ECECEC] dark:bg-white/15" />}

        {statuses.map((status) => (
          <span key={status} className={CHIP}>
            {PICKUP_STATUS_LABELS[status]}
            <button
              type="button"
              onClick={() => toggleStatus(status)}
              title={`Quitar ${PICKUP_STATUS_LABELS[status]}`}
              aria-label={`Quitar ${PICKUP_STATUS_LABELS[status]}`}
              className="ml-0.5 cursor-pointer rounded p-0.5 text-[#FF3F1A]/70 hover:text-[#FF3F1A]"
            >
              <XMarkIcon className="size-3.5 stroke-[2.5]" aria-hidden="true" />
            </button>
          </span>
        ))}

        {carrier && (
          <span className={CHIP}>
            {carrier}
            <button
              type="button"
              onClick={() => setCarrier(null)}
              title={`Quitar ${carrier}`}
              aria-label={`Quitar ${carrier}`}
              className="ml-0.5 cursor-pointer rounded p-0.5 text-[#FF3F1A]/70 hover:text-[#FF3F1A]"
            >
              <XMarkIcon className="size-3.5 stroke-[2.5]" aria-hidden="true" />
            </button>
          </span>
        )}

        {query && (
          <span className={CHIP}>
            «{search.trim()}»
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Quitar la búsqueda"
              aria-label="Quitar la búsqueda"
              className="ml-0.5 cursor-pointer rounded p-0.5 text-[#FF3F1A]/70 hover:text-[#FF3F1A]"
            >
              <XMarkIcon className="size-3.5 stroke-[2.5]" aria-hidden="true" />
            </button>
          </span>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-theme-xs font-bold text-[#212121]/45 underline-offset-2 transition-colors hover:text-[#212121] hover:underline dark:text-white/40 dark:hover:text-white cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {isRecurring ? (
        recurring.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#ECECEC] bg-white px-5 py-16 text-center dark:border-white/10 dark:bg-gray-900">
            <EmptyIllustration />
            <p className="text-theme-sm font-normal text-[#212121]/45 dark:text-white/40">
              {hasFilters ? EMPTY_FILTERS : "Aún no tienes recolecciones fijas configuradas"}
            </p>
            {!hasFilters && (
              <button
                type="button"
                onClick={() => openSettings()}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#FF3F1A] px-3 text-theme-xs font-bold text-[#FF3F1A] transition-colors hover:bg-[#FF3F1A]/10"
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
                Configurar recolección
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recurring.map((c) => (
              <RecurringPickupCard
                key={c.id}
                settings={c}
                onEdit={() => openSettings(c.id)}
                onToggle={() => pickupStore.toggleActive(c.id)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#ECECEC] bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
          <table className="w-full min-w-[1040px] text-left text-theme-xs">
            <thead>
              <tr className="border-b border-[#ECECEC] font-bold text-[#190088] dark:border-white/10 dark:text-white/80">
                <th className="whitespace-nowrap px-4 py-4">Transportadora</th>
                <th className="whitespace-nowrap px-4 py-4">Id de Recolección</th>
                <th className="whitespace-nowrap px-4 py-4">Bodega</th>
                <th className="whitespace-nowrap px-4 py-4">Fecha Programada de Recolección</th>
                <th className="whitespace-nowrap px-4 py-4">Estado</th>
                <th className="whitespace-nowrap px-4 py-4">N° de Paquetes</th>
                <th className="whitespace-nowrap px-4 py-4">Horario de Recolección</th>
                <th className="whitespace-nowrap px-4 py-4">Persona que Despacha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECECEC] dark:divide-white/10">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <EmptyIllustration />
                      <p className="text-theme-sm font-normal text-[#212121]/45 dark:text-white/40">
                        {EMPTY_FILTERS}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                appointments.map((r) => <PickupRow key={r.id} pickup={r} />)
              )}
            </tbody>
          </table>
        </div>
      )}

      {formData && (
        <Modal isOpen onClose={() => setFormData(null)} className="max-w-lg p-6">
          <h2 className="text-2xl font-bold text-[#190088] dark:text-white">Nueva recolección</h2>
          <p className="mt-1 text-theme-xs font-light text-[#212121]/60 dark:text-white/50">
            Agenda la cita con la transportadora. Nace como <strong>Programada</strong>: la asignación la
            confirma ella, no este formulario.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-theme-xs font-bold text-[#212121] dark:text-white/80">Transportadora</span>
              <select
                value={formData.carrier}
                onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                className={field}
              >
                <option value="">Elige una…</option>
                {CARRIERS.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-theme-xs font-bold text-[#212121] dark:text-white/80">Bodega</span>
              <input
                value={formData.warehouse}
                onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                placeholder="Ej: Bodega Principal"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-theme-xs font-bold text-[#212121] dark:text-white/80">
                Fecha programada
              </span>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-theme-xs font-bold text-[#212121] dark:text-white/80">
                Horario de recolección
              </span>
              <input
                value={formData.timeSlot}
                onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                placeholder="Ej: 14:00 - 16:00"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-theme-xs font-bold text-[#212121] dark:text-white/80">
                N° de paquetes
              </span>
              <input
                type="number"
                min={1}
                value={formData.packages}
                onChange={(e) => setFormData({ ...formData, packages: e.target.value })}
                placeholder="Ej: 24"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-theme-xs font-bold text-[#212121] dark:text-white/80">
                Persona que despacha
              </span>
              <input
                value={formData.dispatcher}
                onChange={(e) => setFormData({ ...formData, dispatcher: e.target.value })}
                placeholder="Quién entrega los paquetes en la puerta"
                className={field}
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-[#FF3F1A]/10 px-3 py-2 text-theme-xs font-bold text-[#FF3F1A]"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button size="sm" variant="outline" onClick={() => setFormData(null)}>
              Cancelar
            </Button>
            <button
              type="button"
              onClick={save}
              className="flex h-9 items-center rounded-lg bg-[#FF3F1A] px-4 text-theme-xs font-bold text-white transition-colors hover:bg-[#FF3F1A]/90 cursor-pointer"
            >
              Programar recolección
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
});

export default CarriersPage;
