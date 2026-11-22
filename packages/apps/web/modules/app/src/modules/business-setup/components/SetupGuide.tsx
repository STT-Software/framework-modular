import { observer } from "mobx-react-lite";
import { BoardArt, DirectoryArt, GuideFigure } from "@/components/configuration/GuideFigure";
import { categoryLabel } from "@/modules/businesses";
import { businessSetupStore } from "../stores/businessSetup.store";
import type { SetupStep } from "../types";

export const SetupGuide = observer(({ step }: { step: SetupStep }) => {
  const store = businessSetupStore;
  const state = store.state;
  if (!state) return null;

  const form = store.form;
  const name = form.name.trim() || state.profile.name || "Mi negocio";
  const category = store.categoryDraft
    ? categoryLabel(store.categoryDraft, store.categoryDraft === "other" ? store.categoryOther.trim() : null)
    : categoryLabel(state.category.id, state.category.other);

  switch (step) {
    case "data":
      return (
        <GuideFigure
          title="Identidad y presencia de tu negocio"
          description="Estos datos representan a tu empresa en facturación, comunicaciones con tus clientes y en cada uno de tus módulos activados."
          alternative={`Ficha de identidad para ${name}.`}
        >
          <BoardArt
            label="DATOS DEL NEGOCIO"
            title={name}
            icon="store"
            metric={form.phone.trim() || state.profile.phone || "Sin teléfono"}
            items={[
              {
                label: "Correo de contacto",
                value: form.supportEmail.trim() || state.profile.supportEmail || "contacto@necto.co",
                icon: "mail",
              },
              {
                label: "Dirección",
                value: form.address.trim() || state.profile.address || "Principal",
                icon: "store",
              },
              {
                label: "NIT / ID Fiscal",
                value: form.taxId.trim() || state.profile.taxId || "Sin registro",
                icon: "file",
              },
            ]}
          />
        </GuideFigure>
      );

    case "category":
      return (
        <GuideFigure
          title="El rubro define las sugerencias de tus módulos"
          description={`Al confirmar «${category}», Necto sugiere filas de atención en Turnos, modalidades de entrega en Pedidos y flujos optimizados para tu sector.`}
          alternative={`Categoría comercial asignada: ${category}.`}
        >
          <DirectoryArt
            title={category}
            icon="store"
            entries={["Turnos y atención", "Pedidos y despachos", "Horarios de operación"]}
          />
        </GuideFigure>
      );

    case "review":
      return (
        <GuideFigure
          title="Todo listo para activar tus módulos"
          description="Al confirmar esta base, tu negocio queda preparado con identidad, horarios de atención y presencia comercial en todos sus módulos."
          alternative="Expediente de confirmación de la configuración base."
        >
          <BoardArt
            label="CONFIGURACIÓN BASE"
            title={name}
            icon="check"
            metric={category}
            items={[
              { label: "Identidad", value: "Datos y logo listos", icon: "store" },
              { label: "Horarios", value: "Semana configurada", icon: "time" },
              { label: "Módulos", value: `${state.modules.length} disponibles`, icon: "list" },
            ]}
          />
        </GuideFigure>
      );

    case "schedule":
    default:
      return null;
  }
});
