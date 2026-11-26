import { useState } from "react";
import { CheckIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";

import {
    WEEKDAYS,
    DAY_LABELS,
    SLOT_LABELS,
    PICKUP_SLOTS,
    type RecurringPickupInput,
    type Weekday,
    type PickupSlot,
} from "../domain/pickupDomain";
import { CARRIERS, carrierByName, type Carrier } from "../domain/carrierDirectory";
import { field } from "../pickupFields";

const FormSection = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2.5">
    <div>
      <h2 className="text-theme-sm font-bold text-[#212121] dark:text-white">{title}</h2>
      {hint && (
        <p className="mt-0.5 text-[11px] font-normal leading-snug text-[#212121]/50 dark:text-white/40">
          {hint}
        </p>
      )}
    </div>
    {children}
  </section>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-bold text-[#212121]/70 dark:text-white/60">{children}</span>
);

interface Props {
  initial: RecurringPickupInput;
  editing: boolean;
  error: string | null;
  availableCarriers?: Carrier[];
  defaultCarrierName?: string;
  favoriteCarrierName?: string | null;
  onCancel: () => void;
  onSave: (data: RecurringPickupInput) => void;

  onEdit: () => void;
}

export const PickupSettings = ({
  initial,
  editing,
  error,
  availableCarriers,
  defaultCarrierName,
  favoriteCarrierName,
  onCancel,
  onSave,
  onEdit,
}: Props) => {
  const [data, setData] = useState<RecurringPickupInput>(() => ({
    ...initial,
    carrier: initial.carrier || (!editing && defaultCarrierName ? defaultCarrierName : ""),
  }));

  const resolvedFavoriteName =
    favoriteCarrierName !== undefined ? favoriteCarrierName : (defaultCarrierName ?? null);

  const baseCarriers = availableCarriers && availableCarriers.length > 0 ? availableCarriers : CARRIERS;
  const options =
    data.carrier && !baseCarriers.some((c) => c.name === data.carrier)
      ? [
          ...baseCarriers,
          carrierByName(data.carrier) ?? { id: `custom-${data.carrier}`, name: data.carrier },
        ]
      : baseCarriers;

  const updateField = <K extends keyof RecurringPickupInput>(
    key: K,
    value: RecurringPickupInput[K],
  ) => {
    onEdit();
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: Weekday) => {
    onEdit();
    setData((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  return (
    <div className="flex w-full flex-col gap-6 font-sans">

      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ECECEC]/70 text-[#190088] dark:bg-white/[0.06] dark:text-white">
          <ClipboardDocumentListIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#190088] lg:text-title-md dark:text-white">
            Configurar Recogida
          </h1>
          <p className="mt-1 max-w-2xl text-theme-sm font-light text-[#212121]/70 dark:text-white/60">
            Selecciona los datos de tu recolección para programar o configurar una recogida.
          </p>
        </div>
      </header>

      <FormSection
        title="Elige uno o varios días de la semana para configurar la recolección."
        hint="La transportadora pasará por la bodega todos los días que marques."
      >
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => {
            const active = data.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={active}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-colors ${
                  active
                    ? "border-[#FF3F1A] bg-[#FF3F1A]/10"
                    : "border-[#ECECEC] hover:border-[#212121]/20 dark:border-white/15 dark:hover:border-white/30"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
                    active
                      ? "border-[#FF3F1A] bg-[#FF3F1A] text-white"
                      : "border-[#212121]/25 dark:border-white/25"
                  }`}
                >
                  {active && <CheckIcon className="size-3" strokeWidth={3} aria-hidden="true" />}
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    active ? "text-[#FF3F1A]" : "text-[#212121]/70 dark:text-white/60"
                  }`}
                >
                  {DAY_LABELS[day]}
                </span>
              </button>
            );
          })}
        </div>
      </FormSection>

      <FormSection
        title="Transportadora"
        hint="La que pasa por la bodega. Si cambia, la recolección es otra."
      >
        <select
          value={data.carrier}
          onChange={(e) => updateField("carrier", e.target.value)}
          aria-label="Transportadora"
          className={`${field} max-w-sm`}
        >
          <option value="">Elige una…</option>
          {options.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
              {resolvedFavoriteName && t.name === resolvedFavoriteName ? " ★ Favorita" : ""}
            </option>
          ))}
        </select>
      </FormSection>

      <FormSection
        title="Bodega"
        hint="Lugar en el que se hará la recolección de paquetes según corresponda."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>Nombre de la bodega</FieldLabel>
            <input
              value={data.warehouse}
              onChange={(e) => updateField("warehouse", e.target.value)}
              placeholder="Ej: Bodega Principal"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>Dirección</FieldLabel>
            <input
              value={data.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Ej: Calle 36 Sur #48B-85, Medellín"
              className={field}
            />
          </label>
        </div>
      </FormSection>

      <section className="rounded-2xl border border-[#ECECEC] p-4 dark:border-white/10">
        <h2 className="text-theme-sm font-bold text-[#212121] dark:text-white">
          Datos de quien despacha
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>Nombre de quien despacha</FieldLabel>
            <input
              value={data.dispatcherFirstName}
              onChange={(e) => updateField("dispatcherFirstName", e.target.value)}
              placeholder="Ej: Fulanito"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <FieldLabel>Apellidos</FieldLabel>
            <input
              value={data.dispatcherLastName}
              onChange={(e) => updateField("dispatcherLastName", e.target.value)}
              placeholder="Ej: De Tal"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <FieldLabel>Rango de recolección</FieldLabel>
            <select
              value={data.slot}
              onChange={(e) => updateField("slot", e.target.value as PickupSlot)}
              className={field}
            >
              {PICKUP_SLOTS.map((r) => (
                <option key={r} value={r}>
                  {SLOT_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <FieldLabel>Número de paquetes</FieldLabel>
            <input
              type="number"
              min={1}
              value={data.packages}
              onChange={(e) => updateField("packages", e.target.value)}
              placeholder="Ej: 24"
              className={field}
            />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <FieldLabel>Información adicional de la recolección (opcional)</FieldLabel>
          <textarea
            value={data.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={3}
            placeholder="Ej: llamar al llegar, el portón está sobre la carrera"
            className="w-full resize-y rounded-xl border border-[#ECECEC] bg-white px-3 py-2 text-theme-sm text-[#212121] outline-hidden transition-colors focus:border-[#97D6DF] focus:ring-2 focus:ring-[#97D6DF]/25 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
        </label>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#FF3F1A]/10 px-3 py-2 text-theme-xs font-bold text-[#FF3F1A]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECEC] pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 cursor-pointer items-center rounded-xl border border-[#ECECEC] px-4 text-theme-xs font-bold text-[#212121]/70 transition-colors hover:text-[#212121] dark:border-white/15 dark:text-white/60 dark:hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(data)}
          className="flex h-10 cursor-pointer items-center rounded-xl bg-[#FF3F1A] px-4 text-theme-xs font-bold text-white transition-colors hover:bg-[#FF3F1A]/90"
        >
          {editing ? "Guardar cambios" : "Configurar Recolección"}
        </button>
      </div>
    </div>
  );
};
