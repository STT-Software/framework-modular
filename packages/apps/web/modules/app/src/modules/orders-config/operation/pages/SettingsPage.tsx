import { useState } from "react";
import { observer } from "mobx-react-lite";
import { PlugInIcon } from "@/icons";
import { type ModalityType, type PedidosOperatorView } from "../../types";

const modalityNames: Record<ModalityType, { name: string; desc: string }> = {
  delivery: {
    name: "Envío a domicilio",
    desc: "Despacha pedidos a través de mensajería propia o transportadoras integradas.",
  },
  pickup: {
    name: "Retiro en local",
    desc: "Permite a tus clientes retirar sus compras preparadas directamente en tu sede.",
  },
  on_site: {
    name: "En el establecimiento",
    desc: "Atiende pedidos en mesa, barra o mostrador dentro de tus instalaciones.",
  },
};

export const SettingsPage = observer(({ view }: { view: PedidosOperatorView }) => {
  const [modalities, setModalities] = useState<ModalityType[]>(view.modalities);
  const [saved, setSaved] = useState(false);

  const toggleModality = (m: ModalityType) => {
    setModalities((prev) =>
      prev.includes(m)
        ? prev.length > 1
          ? prev.filter((x) => x !== m)
          : prev
        : [...prev, m]
    );
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-brand-500 uppercase">
            PEDIDOS · CONFIGURACIÓN
          </span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            Ajuste de Pedidos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Configuración de modalidades, tiempos de respuesta y flujo de {view.business.name}.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors shadow-theme-xs cursor-pointer"
          >
            <PlugInIcon className="size-4" />
            <span>{saved ? "Guardado con éxito" : "Guardar ajustes"}</span>
          </button>
        </div>
      </header>

      {/* MODALITIES SECTION */}
      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-theme-xs">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Modalidades de venta habilitadas
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Define cómo pueden comprar y recibir pedidos tus clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          {(["delivery", "pickup", "on_site"] as ModalityType[]).map((mod) => {
            const isEnabled = modalities.includes(mod);
            const { name, desc } = modalityNames[mod];
            return (
              <button
                key={mod}
                type="button"
                onClick={() => toggleModality(mod)}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  isEnabled
                    ? "border-brand-500 bg-brand-50/40 dark:bg-brand-500/10"
                    : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02] opacity-75"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {name}
                  </span>
                  <span
                    className={`size-2.5 rounded-full ${
                      isEnabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* CONFIRMATION & NOTIFICATIONS */}
      <section className="flex flex-col gap-4 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-theme-xs">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Confirmación y Tiempos de Entrega
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configuración de confirmación de pedidos entrantes y alertas operativas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-white/[0.01]">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Modo de confirmación
            </span>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
              {view.confirmationMode === "manual" ? "Revisión manual por operador" : "Confirmación automática"}
            </p>
            <span className="text-xs text-gray-400 dark:text-gray-500 block mt-1">
              Los pedidos pasan por la etapa de Confirmación antes de ingresar a cocina o alistamiento.
            </span>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-white/[0.01]">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Horario de atención
            </span>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
              {view.schedule?.openNow !== null ? (view.schedule.openNow ? "Abierto ahora" : "Cerrado según horario") : "Horario continuo"}
            </p>
            <span className="text-xs text-gray-400 dark:text-gray-500 block mt-1">
              {view.schedule?.timezone ? `Zona horaria: ${view.schedule.timezone}` : "Sin horario específico programado."}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
});
