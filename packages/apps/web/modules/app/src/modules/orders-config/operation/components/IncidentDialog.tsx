import { useEffect, useState } from "react";

import { Modal } from "./Dialog";
import { Button } from "@/elements/ui/button";
import {
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ExclamationTriangleIcon,
    MapPinIcon,
    SparklesIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

import { carrierByName } from "../domain/carrierDirectory";
import { CarrierLogo } from "./CarrierLogo";
import {
    INCIDENT_STATUS_LABELS,
    MAX_NOTE_LENGTH,
    MIN_NOTE_LENGTH,
    RESOLUTION_OPTIONS,
    incidentStatusClass,
    daysOpen,
    todayISO,
    describeIncident,
    resolutionById,
    type ResolutionInput,
    type Incident,
} from "../domain/incidentDomain";

const EMPTY: ResolutionInput = {
  resolution: "",
  notes: "",
  retryDate: "",
  newAddress: "",
  newCity: "",
  recipientName: "",
  recipientPhone: "",
};

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-theme-xs text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

function SummaryCard({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
        {caption}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
  hint,
  className = "",
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[10.5px] text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export interface IncidentDialogProps {
  incident: Incident | null;
  onClose: () => void;

  onResolve: (id: string, data: ResolutionInput) => string | null;
}

export const IncidentDialog = ({
  incident,
  onClose,
  onResolve,
}: IncidentDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [data, setData] = useState<ResolutionInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(1);
    setData(EMPTY);
    setError(null);
  }, [incident?.id]);

  if (!incident) return null;

  const option = data.resolution ? resolutionById(data.resolution) : undefined;
  const reading = describeIncident(incident);

  const updateField = <K extends keyof ResolutionInput>(field: K, value: ResolutionInput[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));

    if (error) setError(null);
  };

  const proceed = () => {
    if (!data.resolution) {
      setError("Elige cómo se reintenta la entrega.");
      return;
    }

    setError(null);
    setStep(2);
  };

  const resolveIssue = () => {
    const failure = onResolve(incident.id, data);
    if (failure) setError(failure);
  };

  return (
    <Modal isOpen onClose={onClose} className="max-w-2xl">
      <div className="flex max-h-[88vh] flex-col">

        <header className="flex items-start gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15">
            <ExclamationTriangleIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink-title dark:text-white">
              Gestionar novedad
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              Completa los datos del formulario para solucionar la novedad presentada con tu pedido.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {step === 1 ? (
            <>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <SummaryCard caption="Cliente">
                  <div className="truncate text-[12.5px] font-bold text-ink-body dark:text-gray-100">
                    {incident.customer}
                  </div>
                  <div className="truncate text-[10.5px] text-gray-500 dark:text-gray-400">
                    Tel. {incident.phone}
                  </div>
                  <div className="truncate text-[10.5px] text-gray-500 dark:text-gray-400">
                    {incident.city}
                  </div>
                </SummaryCard>

                <SummaryCard caption="Días en novedad">
                  <div className="text-[12.5px] font-bold tabular-nums text-ink-body dark:text-gray-100">
                    {daysOpen(incident.createdAt)}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-[9.5px] font-bold ${incidentStatusClass(incident.status)}`}
                    >
                      {INCIDENT_STATUS_LABELS[incident.status]}
                    </span>
                  </div>
                </SummaryCard>

                <SummaryCard caption="Transportadora">
                  <div className="flex items-center gap-2">
                    <CarrierLogo
                      carrier={carrierByName(incident.carrier)}
                      name={incident.carrier}
                      size="sm"
                    />
                    <span className="truncate text-[10.5px] font-bold text-ink-body dark:text-gray-100">
                      {incident.carrier}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-gray-400">
                    Guía {incident.trackingNumber}
                  </div>
                </SummaryCard>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[12.5px] font-bold text-ink-body dark:text-gray-100">
                    Observaciones de la novedad
                  </h3>
                  <span className="inline-flex h-4 items-center rounded bg-estado-amarillo px-1.5 text-[9px] font-bold uppercase tracking-wide text-ink-body dark:bg-estado-amarillo/20 dark:text-estado-amarillo">
                    Beta
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] italic text-brand-500">
                    <SparklesIcon className="size-3.5" />
                    Interpretación generada a partir del registro
                  </span>
                </div>

                <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
                  <ol className="list-decimal space-y-1 pl-4 text-[11.5px] leading-relaxed text-gray-600 marker:text-gray-400 dark:text-gray-300">
                    {reading.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="solucion-novedad"
                  className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200"
                >
                  Solución a novedad
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="solucion-novedad"
                    value={data.resolution}
                    onChange={(e) =>
                      updateField("resolution", e.target.value as ResolutionInput["resolution"])
                    }
                    className={`${INPUT_CLASS} cursor-pointer appearance-none pr-9`}
                  >
                    <option value="">Seleccionar</option>
                    {RESOLUTION_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                </div>

                {option && (
                  <p className="mt-2 flex items-start gap-1.5 text-[10.5px] text-gray-500 dark:text-gray-400">
                    <CheckCircleIcon className="mt-px size-3.5 shrink-0 text-brand-500" />
                    {option.hint}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>

              <div>
                <div className="text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                  Solución a novedad
                </div>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-estado-amarillo px-3 py-2.5 text-[12px] font-medium text-ink-body dark:bg-estado-amarillo/15 dark:text-estado-amarillo">
                  <CheckCircleIcon className="size-4 shrink-0" />
                  {option?.label}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {option?.requires === "date" && (
                  <Field id="fecha-reintento" label="Fecha" className="sm:col-span-2">
                    <input
                      id="fecha-reintento"
                      type="date"
                      min={todayISO()}
                      value={data.retryDate ?? ""}
                      onChange={(e) => updateField("retryDate", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                )}

                {(option?.requires === "address" || option?.requires === "city") && (
                  <Field
                    id="direccion-nueva"
                    label={option.fieldLabel ?? "Dirección nueva"}
                    hint={option.fieldHint}
                    className="sm:col-span-2"
                  >
                    <div className="relative">
                      <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="direccion-nueva"
                        type="text"
                        value={
                          option.requires === "city"
                            ? (data.newCity ?? "")
                            : (data.newAddress ?? "")
                        }
                        onChange={(e) =>
                          option.requires === "city"
                            ? updateField("newCity", e.target.value)
                            : updateField("newAddress", e.target.value)
                        }
                        placeholder={
                          option.requires === "city"
                            ? "Ej. Envigado · Carrera 43A #18-95"
                            : "Ej. Carrera 76 #33-10, barrio Laureles"
                        }
                        className={`${INPUT_CLASS} pl-9`}
                      />
                    </div>
                  </Field>
                )}

                <Field id="recibe-nombre" label="Nombre de quién recibe">
                  <input
                    id="recibe-nombre"
                    type="text"
                    value={data.recipientName ?? ""}
                    onChange={(e) => updateField("recipientName", e.target.value)}
                    placeholder="Ingresa el nombre de la persona"
                    className={INPUT_CLASS}
                  />
                </Field>

                <Field id="recibe-telefono" label="Teléfono">
                  <div className="flex h-10 items-center overflow-hidden rounded-xl border border-gray-300 bg-white transition-colors focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900">
                    <span className="flex h-full items-center border-r border-gray-200 px-2.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      +57
                    </span>
                    <input
                      id="recibe-telefono"
                      type="tel"
                      inputMode="tel"
                      value={data.recipientPhone ?? ""}
                      onChange={(e) => updateField("recipientPhone", e.target.value)}
                      placeholder="Ingresa un teléfono"
                      className="h-full w-full min-w-0 bg-transparent px-2.5 text-theme-xs text-ink-body outline-none placeholder:text-gray-400 dark:text-gray-100"
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="notes"
                  className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200"
                >
                  Observaciones
                </label>
                <p className="mt-1 text-[10.5px] text-gray-500 dark:text-gray-400">
                  Es lo único que la transportadora lee en la calle: quién recibe, en qué horario y
                  por qué entrada.
                </p>
                <textarea
                  id="notes"
                  rows={4}
                  maxLength={MAX_NOTE_LENGTH}
                  value={data.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Ej. Entregar a la hija de la señora, después de las 2 p.m."
                  className="mt-1.5 w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-theme-xs leading-relaxed text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <div className="mt-1 flex items-center justify-between text-[10.5px] text-gray-400 dark:text-gray-500">
                  <span>Mínimo {MIN_NOTE_LENGTH} caracteres.</span>
                  <span className="font-mono tabular-nums">
                    {data.notes.length}/{MAX_NOTE_LENGTH}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          {error && (
            <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-error-500/10 px-3 py-2 text-[11.5px] text-error-500">
              <ExclamationTriangleIcon className="mt-px size-3.5 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            {step === 1 ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Paso 1 de 2</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="inline-flex items-center gap-1 text-[11.5px] font-bold text-gray-500 transition-colors hover:text-ink-body cursor-pointer dark:text-gray-400 dark:hover:text-white"
              >
                <ChevronLeftIcon className="size-3.5" />
                Regresar
              </button>
            )}

            <div className="flex items-center gap-2">
              {step === 1 ? (
                <Button variant="primary" size="sm" onClick={proceed}>
                  Continuar
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={resolveIssue}>
                  Solucionar
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </Modal>
  );
};
