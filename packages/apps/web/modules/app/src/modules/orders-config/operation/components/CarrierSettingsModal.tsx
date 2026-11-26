import { useEffect, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

import { Button } from "@/elements/ui/button";
import { Modal } from "./Dialog";
import { CarrierLogo } from "./CarrierLogo";
import { CARRIERS, type Carrier } from "../domain/carrierDirectory";
import {
  getFavoriteCarrier,
  setFavoriteCarrier,
  toggleCarrierEnabled,
  type CarrierPreferences,
} from "../domain/carrierSelection";

export interface CarrierSettingsModalProps {
  open: boolean;
  preferences: CarrierPreferences;
  onSave: (next: CarrierPreferences) => void;
  onClose: () => void;
}

const RecuadroLogo = ({ carrier }: { carrier: Carrier }) => {
  const isDark = carrier.logoBackground === "dark";
  return (
    <div
      className={`flex h-24 w-full items-center justify-center rounded-xl border px-4 py-3 ${
        isDark
          ? "border-[#212121] bg-[#212121]"
          : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950/60"
      }`}
    >
      <CarrierLogo
        carrier={carrier}
        name={carrier.name}
        size="lg"
        className={isDark ? "ring-0 bg-[#212121]" : "ring-0 bg-transparent"}
      />
    </div>
  );
};

export const CarrierSettingsModal = ({
  open,
  preferences,
  onSave,
  onClose,
}: CarrierSettingsModalProps) => {
  const [draft, setDraft] = useState<CarrierPreferences>(preferences);
  const [configCarrierId, setConfigCarrierId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({
        enabledIds: [...preferences.enabledIds],
        favoriteId: preferences.favoriteId,
      });
      setConfigCarrierId(null);
      setError(null);
    }
  }, [open, preferences]);

  if (!open) return null;

  const favorite = getFavoriteCarrier(draft);
  const enabledCount = draft.enabledIds.length;
  const configCarrier = configCarrierId
    ? (CARRIERS.find((item) => item.id === configCarrierId) ?? null)
    : null;

  const handleToggleQuote = (carrierId: string) => {
    const result = toggleCarrierEnabled(draft, carrierId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setDraft(result.value);
  };

  const handleToggleFavorite = (carrierId: string, nextFavorite: boolean) => {
    setError(null);
    setDraft((prev) => setFavoriteCarrier(prev, nextFavorite ? carrierId : null));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleRequestClose = () => {
    if (configCarrierId) {
      setConfigCarrierId(null);
      return;
    }
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={handleRequestClose}
      label="Configurar transportadoras"
      className="w-[min(94vw,56rem)]"
    >
      <div className="relative flex max-h-[88vh] flex-col font-sans">
        <header className="flex items-start gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
            <AdjustmentsHorizontalIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink-title dark:text-white">
              Configurar transportadoras
            </h2>
            <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">
              Activa las transportadoras habilitadas para cotizar envíos y define opcionalmente tu
              transportadora favorita desde el ícono de ajustes de cada tarjeta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-6 py-2.5 text-[11.5px] dark:border-gray-800 dark:bg-white/[0.02]">
          <span className="font-semibold text-ink-body dark:text-gray-200">
            {enabledCount} de {CARRIERS.length}{" "}
            {enabledCount === 1 ? "transportadora activa" : "transportadoras activas"} para cotizar
          </span>
          {favorite ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <StarSolidIcon className="size-3.5 text-amber-500" aria-hidden="true" />
              Favorita: {favorite.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Sin transportadora favorita
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARRIERS.map((carrier) => {
              const isEnabled = draft.enabledIds.includes(carrier.id);
              const isFavorite = draft.favoriteId === carrier.id;

              return (
                <article
                  key={carrier.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                    isFavorite
                      ? "border-amber-300 bg-amber-50/30 shadow-theme-xs dark:border-amber-500/40 dark:bg-amber-500/[0.05]"
                      : isEnabled
                        ? "border-gray-200 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900"
                        : "border-gray-100 bg-gray-50/70 opacity-80 dark:border-gray-800/70 dark:bg-gray-900/50"
                  }`}
                >
                  {/* Top reserved favorite star badge strip + gear settings button */}
                  <div className="mb-3 flex min-h-7 items-center justify-between gap-2">
                    <div className="flex items-center">
                      {isFavorite ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                          <StarSolidIcon className="size-3 text-amber-500" aria-hidden="true" />
                          Favorita
                        </span>
                      ) : (
                        <span className="h-5" aria-hidden="true" />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfigCarrierId(carrier.id)}
                      aria-label={`Configurar ${carrier.name}`}
                      title={`Configurar ${carrier.name}`}
                      className="flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-ink-title cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      <Cog6ToothIcon className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Logo box + name */}
                  <div className="flex flex-col items-center gap-2.5">
                    <RecuadroLogo carrier={carrier} />
                    <h3 className="text-center text-theme-sm font-bold text-ink-title dark:text-white">
                      {carrier.name}
                    </h3>
                  </div>

                  {/* Footer with orange switch "Cotizar envíos" */}
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                    <span className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">
                      Cotizar envíos
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`Cotizar envíos con ${carrier.name}`}
                      onClick={() => handleToggleQuote(carrier.id)}
                      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        isEnabled ? "bg-[#FF3F1A]" : "bg-gray-200 dark:bg-white/15"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
                          isEnabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          {error && (
            <p
              role="alert"
              className="mb-3 flex items-start gap-1.5 rounded-lg bg-error-500/10 px-3 py-2 text-[11.5px] font-medium text-error-600 dark:text-error-400"
            >
              <ExclamationTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Guardar preferencias
            </Button>
          </div>
        </footer>

        {/* Dedicated sub-modal: "Configurar transportadora" */}
        {configCarrier && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setConfigCarrierId(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Configurar transportadora ${configCarrier.name}`}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Cog6ToothIcon className="size-4.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-ink-title dark:text-white">
                    Configurar transportadora
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigCarrierId(null)}
                  aria-label="Cerrar configuración de transportadora"
                  className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <XMarkIcon className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                  <CarrierLogo carrier={configCarrier} name={configCarrier.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-title dark:text-white">
                      {configCarrier.name}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {draft.enabledIds.includes(configCarrier.id)
                        ? "Activa para cotizar envíos"
                        : "Desactivada para cotizar envíos"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-950/40">
                  <div className="min-w-0">
                    <p className="text-theme-xs font-bold text-ink-title dark:text-white">
                      Usar como favorita
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      Se preseleccionará en nuevas recolecciones. Si la apagas, quedarás sin
                      transportadora favorita.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.favoriteId === configCarrier.id}
                    aria-label={`Usar ${configCarrier.name} como favorita`}
                    onClick={() =>
                      handleToggleFavorite(
                        configCarrier.id,
                        draft.favoriteId !== configCarrier.id,
                      )
                    }
                    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      draft.favoriteId === configCarrier.id
                        ? "bg-emerald-500"
                        : "bg-gray-200 dark:bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
                        draft.favoriteId === configCarrier.id ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                <Button variant="primary" size="sm" onClick={() => setConfigCarrierId(null)}>
                  Listo
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CarrierSettingsModal;
