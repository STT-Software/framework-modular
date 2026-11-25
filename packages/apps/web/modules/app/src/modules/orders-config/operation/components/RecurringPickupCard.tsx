import { observer } from "mobx-react-lite";
import { ArrowTopRightOnSquareIcon, MapPinIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

import {
    WEEKDAYS,
    SLOT_LABELS,
    SLOT_TIMES,
    DAY_INITIAL,
    formatFrequency,
    type RecurringPickup,
} from "../domain/pickupDomain";
import { carrierByName } from "../domain/carrierDirectory";

function mapUrl(address: string, warehouse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${warehouse}`)}`;
}

const FormSection = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[#212121]/40 dark:text-white/35">
      {label}
    </p>
    <div className="mt-1.5">{children}</div>
  </div>
);

const Toggle = ({
  enabled,
  onUpdate,
  label,
}: {
  enabled: boolean;
  onUpdate: () => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    onClick={onUpdate}
    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
      enabled ? "bg-success-500" : "bg-[#ECECEC] dark:bg-white/15"
    }`}
  >
    <span
      className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
        enabled ? "left-[22px]" : "left-0.5"
      }`}
    />
  </button>
);

interface Props {
  settings: RecurringPickup;
  onEdit: () => void;
  onToggle: () => void;
}

export const RecurringPickupCard = observer(
  ({ settings: c, onEdit, onToggle }: Props) => {
    const carrier = carrierByName(c.carrier);
    const days = formatFrequency(c.days);

    return (
      <article
        className={`rounded-2xl border border-[#ECECEC] bg-white p-5 transition-colors dark:border-white/10 dark:bg-gray-900 ${
          c.enabled ? "" : "opacity-70"
        }`}
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {carrier?.logo ? (

              <img
                src={carrier.logo}
                alt=""
                className="h-4 w-auto max-w-[92px] object-contain"
              />
            ) : (
              <span className="size-1.5 rounded-full bg-[#97D6DF]" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="truncate text-theme-sm font-bold text-[#212121] dark:text-white">
                {c.carrier}
              </p>
              <p className="text-[11px] font-normal text-[#212121]/45 dark:text-white/40">
                {c.enabled ? "Activa" : "Pausada"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Toggle
              enabled={c.enabled}
              onUpdate={onToggle}
              label={`${c.enabled ? "Pausar" : "Activar"} la recolección de ${c.carrier}`}
            />
            <button
              type="button"
              onClick={onEdit}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#ECECEC] px-3 text-theme-xs font-bold text-[#212121] transition-colors hover:border-[#FF3F1A] hover:text-[#FF3F1A] dark:border-white/15 dark:text-white/85 dark:hover:border-[#FF3F1A] dark:hover:text-[#FF3F1A]"
            >
              <PencilSquareIcon className="size-4" aria-hidden="true" />
              Editar
            </button>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 border-t border-[#ECECEC] pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
          <FormSection label="Bodega">
            <p className="truncate text-theme-xs font-bold text-[#212121] dark:text-white">
              {c.warehouse}
            </p>
            <p className="mt-0.5 text-[11px] font-normal leading-snug text-[#212121]/55 dark:text-white/45">
              {c.address}
            </p>
            <a
              href={mapUrl(c.address, c.warehouse)}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#FF3F1A] hover:underline"
            >
              <MapPinIcon className="size-3.5" aria-hidden="true" />
              Ver en el mapa
              <ArrowTopRightOnSquareIcon className="size-3" aria-hidden="true" />
            </a>
          </FormSection>

          <FormSection label="Horario de recolección">
            <p className="text-theme-xs font-bold text-[#212121] dark:text-white">
              {SLOT_LABELS[c.slot]}: {SLOT_TIMES[c.slot]}
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-[#212121]/55 dark:text-white/45">
              Franja que asigna la transportadora
            </p>
          </FormSection>

          <FormSection label="Días programados">
            <div className="flex items-center gap-1">
              {WEEKDAYS.map((day) => {
                const active = c.days.includes(day);
                return (
                  <span
                    key={day}
                    title={day}
                    aria-label={day}
                    className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-[#212121] text-white dark:bg-white dark:text-[#212121]"
                        : "border border-[#ECECEC] text-[#212121]/25 dark:border-white/15 dark:text-white/20"
                    }`}
                  >
                    {DAY_INITIAL[day]}
                  </span>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] font-normal text-[#212121]/55 dark:text-white/45">
              {days}
            </p>
          </FormSection>

          <FormSection label="Persona que despacha">
            <p className="truncate text-theme-xs font-bold text-[#212121] dark:text-white">
              {c.dispatcherFirstName} {c.dispatcherLastName}
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-[#212121]/55 dark:text-white/45">
              {c.packages} {c.packages === 1 ? "paquete" : "packages"} por recolección
            </p>
          </FormSection>
        </div>

        {c.notes && (
          <p className="mt-4 rounded-xl bg-[#EFE6D3]/50 px-3 py-2 text-[11px] font-normal leading-relaxed text-[#212121]/75 dark:bg-[#EFE6D3]/10 dark:text-[#EFE6D3]/85">
            {c.notes}
          </p>
        )}
      </article>
    );
  },
);
