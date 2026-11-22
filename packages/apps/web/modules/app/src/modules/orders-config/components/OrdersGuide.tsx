import { observer } from "mobx-react-lite";
import { BoardArt, DispatchArt, GuideFigure, HubArt, TeamArt, TimelineArt } from "@/components/configuration/GuideFigure";
import { PROFILE_DEFAULTS } from "../constants";
import type { CancellationStage, OrdersConfigState, OrdersConfigStep, PaymentMethodId } from "../types";
import {
  isConfirmationExpiryApplicable,
  isConfirmationSlaApplicable,
  isDispatchSlaApplicable,
  isFreightRiskThresholdApplicable,
} from "../validation";

const deliveryChannels = ["delivery", "pickup", "on_site"] as const;
const channelNames = { pickup: "Retiro", delivery: "Domicilio", on_site: "En sitio" };
const confirmationNames = { manual: "Manual", automatic: "Automática", agent: "Por agente" };
const paymentMethodShortNames: Record<PaymentMethodId, string> = {
  cash_on_delivery: "Contra entrega",
  bank_transfer: "Transferencia",
  payment_link: "Link de pago",
  in_store: "En local",
};
const cancellationShortNames: Record<CancellationStage, string> = {
  before_confirmation: "Antes de confirmar",
  before_preparation: "Antes de preparar",
  before_dispatch: "Antes de despachar",
  never: "No permitida",
};

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function short(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function formatCompactFreight(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return short(`Tope: 0 ${currency}`, 19);
  const formatted =
    amount >= 1_000_000
      ? `${
          Number.isInteger(amount / 1_000_000)
            ? amount / 1_000_000
            : (amount / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })
        } M`
      : amount.toLocaleString("es-CO");
  return short(`Tope: ${formatted} ${currency}`, 19);
}

export const OrdersGuide = observer(
  ({ step, state, currency = "COP" }: { step: OrdersConfigStep; state: OrdersConfigState; currency?: string }) => {
    const profile = PROFILE_DEFAULTS[state.profile];
    const channels = state.modalities.map((id) => channelNames[id]).join(", ") || "Ninguna";
    const modalityCount = (count: number) => (count === 1 ? "1 modalidad" : `${count} modalidades`);
    const mode = confirmationNames[state.fulfillment.confirmationMode];
    const teamSize = state.operators.length;
    const activeCurrency = currency || "COP";

    switch (step) {
      case "profile":
        return (
          <GuideFigure
            title="El perfil fija los valores iniciales"
            description={`Al elegir «${profile.name}», se cargan sus modalidades de entrega, reglas de pago y tiempos sugeridos. Puedes ajustarlos en los siguientes pasos.`}
            alternative={`Ficha del negocio con los valores sugeridos del perfil: ${profile.modalities.length} modalidades y ${profile.sla.preparationMinutes} minutos de preparación.`}
          >
            <BoardArt
              label="PEDIDOS"
              title={profile.name}
              icon="store"
              items={[
                { label: "Modalidades iniciales", value: modalityCount(profile.modalities.length), icon: "route" },
                { label: "Preparación", value: `${profile.sla.preparationMinutes} min`, icon: "time" },
                {
                  label: "Confirmación inicial",
                  value: confirmationNames[profile.fulfillment.confirmationMode],
                  icon: "check",
                },
              ]}
            />
          </GuideFigure>
        );

      case "modalities": {
        const onSiteNote = state.modalities.includes("on_site")
          ? state.onSiteMode === "table_or_zone"
            ? " Atención en sitio organizada por mesa o zona."
            : " Atención en sitio directa en barra o mostrador."
          : "";
        return (
          <GuideFigure
            title="Un pedido, distintas formas de entrega"
            description={`Las rutas marcadas corresponden a tus modalidades activas: ${channels}.${onSiteNote}`}
            alternative={`El módulo conecta las tres modalidades de entrega. Modalidades habilitadas: ${channels}.`}
          >
            <HubArt
              icon="box"
              items={deliveryChannels.map((id) => ({
                label: channelNames[id],
                value: state.modalities.includes(id) ? "HABILITADA" : "DESACTIVADA",
                active: state.modalities.includes(id),
                icon: id === "delivery" ? "route" : id === "pickup" ? "box" : "store",
              }))}
            />
          </GuideFigure>
        );
      }

      case "fulfillment": {
        const {
          confirmationMode,
          whatsappNumber,
          riskThresholdActive,
          maxShippingCostRisk,
          hasOwnCourier,
          pickupMode,
          carriers,
          shippingPricingMode,
          flatShippingFee,
          freeShippingThreshold,
          minimumOrderActive,
          minimumOrderAmount,
        } = state.fulfillment;
        const hasDelivery = state.modalities.includes("delivery");
        const hasPickup = state.modalities.includes("pickup");
        const freightActive = isFreightRiskThresholdApplicable(state) && riskThresholdActive;
        const formattedRisk = Number.isFinite(maxShippingCostRisk)
          ? maxShippingCostRisk.toLocaleString("es-CO")
          : "0";

        const explanation = {
          manual: "Un operador revisa cada pedido antes de prepararlo.",
          automatic: "Los pedidos pasan automáticamente a preparación.",
          agent: whatsappNumber.trim()
            ? `El agente de WhatsApp (${whatsappNumber.trim()}) verifica los detalles con el cliente antes de confirmar.`
            : "El agente de WhatsApp verifica los detalles con el cliente antes de confirmar el pedido.",
        }[confirmationMode];

        const shippingRule = freightActive
          ? `Si el flete supera ${formattedRisk} ${activeCurrency}, se requiere aprobación manual.`
          : "";

        const enabledCarriers = carriers.filter((c) => c.enabled);
        const defaultCarrier = enabledCarriers.find((c) => c.isDefault)?.name;

        let channelNote = "";
        let carrierBadge: string | undefined;
        if (hasDelivery) {
          if (hasOwnCourier && enabledCarriers.length > 0) {
            carrierBadge = `Propia + ${enabledCarriers.length} transp.`;
            channelNote = `Operas domicilio con mensajería propia y ${enabledCarriers.length} ${enabledCarriers.length === 1 ? "transportadora" : "transportadoras"}.`;
          } else if (hasOwnCourier) {
            carrierBadge = "Mensajería propia";
            channelNote = "Operas entregas a domicilio con mensajería propia.";
          } else if (enabledCarriers.length > 0) {
            carrierBadge = `${enabledCarriers.length} ${enabledCarriers.length === 1 ? "activa" : "activas"} · ${defaultCarrier ?? "Sin favorita"}`;
            channelNote = `Operas domicilio con ${enabledCarriers.length} ${enabledCarriers.length === 1 ? "transportadora activa" : "transportadoras activas"}.`;
          } else {
            carrierBadge = "Sin canal de envío";
            channelNote = "Activa mensajería propia o al menos una transportadora para habilitar envíos a domicilio.";
          }
        } else if (hasPickup) {
          carrierBadge = pickupMode === "fixed" ? "Retiro por franjas" : "Retiro eventual";
        } else {
          carrierBadge = "Atención en sitio";
        }

        let pricingNote = "";
        if (hasDelivery) {
          if (shippingPricingMode === "fixed") {
            const feeText = Number.isFinite(flatShippingFee) ? flatShippingFee.toLocaleString("es-CO") : "0";
            pricingNote = `Envío con tarifa fija de ${feeText} ${activeCurrency}.`;
          } else if (shippingPricingMode === "free_from") {
            const thresholdText = Number.isFinite(freeShippingThreshold)
              ? freeShippingThreshold.toLocaleString("es-CO")
              : "0";
            pricingNote = `Envío gratis desde ${thresholdText} ${activeCurrency}.`;
          } else {
            pricingNote = "Costo de envío por confirmar con el cliente.";
          }
          if (minimumOrderActive) {
            const minText = Number.isFinite(minimumOrderAmount) ? minimumOrderAmount.toLocaleString("es-CO") : "0";
            pricingNote += ` Pedido mínimo: ${minText} ${activeCurrency}.`;
          }
        }

        const pickupNote = hasPickup
          ? pickupMode === "fixed"
            ? "Retiro en local programado por franjas horarias."
            : "Retiro en local apenas el pedido esté listo."
          : "";

        const freightLabel = freightActive
          ? formatCompactFreight(maxShippingCostRisk, activeCurrency)
          : confirmationMode === "manual"
            ? "Revisión manual"
            : "Pasar a preparación";

        return (
          <GuideFigure
            title="La confirmación precede a la preparación"
            description={[explanation, shippingRule, channelNote, pricingNote, pickupNote].filter(Boolean).join(" ")}
            alternative={`Un pedido pasa por confirmación ${mode.toLowerCase()} antes de llegar a preparación.`}
          >
            <DispatchArt mode={mode} freight={freightLabel} carrier={carrierBadge} />
          </GuideFigure>
        );
      }

      case "payments": {
        const {
          methods,
          requireTransferReceipt,
          requirePrepaymentBeforePrep,
          confirmationExpiryAction,
          cancellationLimit,
        } = state.payments;
        const methodCount = methods.length === 1 ? "1 método" : `${methods.length} métodos`;
        const methodsSummary =
          methods.map((id) => paymentMethodShortNames[id]).join(", ") || "Sin métodos";
        const expiryApplicable = isConfirmationExpiryApplicable(state);
        const expiryLabel = !expiryApplicable
          ? "No aplica (auto)"
          : confirmationExpiryAction === "auto_cancel"
            ? "Cancelar auto."
            : "Solo alertar";
        const prepaymentNote = requirePrepaymentBeforePrep
          ? "El pago debe confirmarse antes de pasar a preparación."
          : "Los pedidos pueden prepararse sin pago previo confirmado.";
        const receiptNote =
          methods.includes("bank_transfer") && requireTransferReceipt
            ? "Se solicitará comprobante para transferencias."
            : "";

        return (
          <GuideFigure
            title="Reglas claras para cobrar y cancelar"
            description={[
              `Aceptas ${methodCount} (${methodsSummary}).`,
              prepaymentNote,
              receiptNote,
              `Cancelación permitida: ${cancellationShortNames[cancellationLimit].toLowerCase()}.`,
            ]
              .filter(Boolean)
              .join(" ")}
            alternative={`Políticas de pago con ${methodCount}, cancelación ${cancellationShortNames[cancellationLimit].toLowerCase()} y vencimiento ${expiryLabel.toLowerCase()}.`}
          >
            <BoardArt
              label="PAGOS Y POLÍTICAS"
              title={requirePrepaymentBeforePrep ? "Pago previo a preparar" : "Pago flexible"}
              icon="check"
              metric={methodCount}
              items={[
                { label: "Métodos activos", value: methodsSummary, icon: "list" },
                { label: "Cancelación", value: cancellationShortNames[cancellationLimit], icon: "file" },
                { label: "Si vence confirmación", value: expiryLabel, icon: "time" },
              ]}
            />
          </GuideFigure>
        );
      }

      case "sla": {
        const {
          confirmationMinutes,
          preparationMinutes,
          dispatchMinutes,
          urgencyThresholdMinutes,
          outOfHoursPolicy,
          outOfHoursAutoReply,
        } = state.sla;
        const needsConfirmation = isConfirmationSlaApplicable(state);
        const hasDelivery = isDispatchSlaApplicable(state);

        const confVal = needsConfirmation ? safeNumber(confirmationMinutes) : 0;
        const prepVal = safeNumber(preparationMinutes);
        const dispVal = hasDelivery ? safeNumber(dispatchMinutes) : 0;
        const urgVal = safeNumber(urgencyThresholdMinutes);

        const applicableParts: string[] = [];
        if (needsConfirmation) applicableParts.push(`Confirmación: ${confVal} min`);
        applicableParts.push(`Preparación: ${prepVal} min`);
        if (hasDelivery) applicableParts.push(`Despacho: ${dispVal} min`);

        const policyNote =
          outOfHoursPolicy === "schedule"
            ? "Fuera de horario se aceptan pedidos programados."
            : "Fuera de horario se bloquean nuevos pedidos.";
        const autoReplyNote = outOfHoursAutoReply
          ? "Respuesta automática activa."
          : "Sin respuesta automática.";

        return (
          <GuideFigure
            title="Cada etapa tiene su propio plazo"
            description={`Plazos activos: ${applicableParts.join(" · ")}. Umbral de urgencia: ${urgVal} min en cola. ${policyNote} ${autoReplyNote}`}
            alternative={`${applicableParts.join(". ")}. Umbral de urgencia: ${urgVal} minutos.`}
          >
            <TimelineArt times={[confVal, prepVal, dispVal]} urgency={urgVal} />
          </GuideFigure>
        );
      }

      case "operators":
        return (
          <GuideFigure
            title={teamSize ? "El equipo que gestiona los pedidos" : "Puedes empezar como administrador"}
            description={
              teamSize
                ? `Tienes ${teamSize} ${teamSize === 1 ? "operador registrado" : "operadores registrados"} con etapas operativas asignadas. Cada persona se identifica con su correo y teléfono de contacto opcional.`
                : "Puedes gestionar los pedidos directamente. Agrega un nombre, un correo y las etapas operativas cuando necesites incorporar a otra persona."
            }
            alternative={`Credenciales del equipo de pedidos. Operadores adicionales: ${teamSize}.`}
          >
            <TeamArt names={state.operators.slice(-2).map((operator) => operator.name)} total={teamSize} />
          </GuideFigure>
        );

      case "review":
        return (
          <GuideFigure
            title="La ficha que vas a guardar"
            description={`Este resumen reúne el perfil «${profile.name}», tus modalidades, envíos, pagos y políticas, tiempos objetivo y equipo. Guarda al final del paso para dejar Pedidos preparado en tu negocio.`}
            alternative={`Una hoja de revisión muestra ${state.modalities.length} modalidades, confirmación ${mode.toLowerCase()} y ${teamSize} operadores.`}
          >
            <BoardArt
              label="REVISIÓN DE PEDIDOS"
              title="Ficha del negocio"
              icon="file"
              metric={profile.name}
              items={[
                { label: "Entrega", value: modalityCount(state.modalities.length), icon: "route" },
                { label: "Confirmación", value: mode, icon: "check" },
                { label: "Equipo", value: `${teamSize} ${teamSize === 1 ? "operador" : "operadores"}`, icon: "key" },
              ]}
            />
          </GuideFigure>
        );
    }
  },
);
