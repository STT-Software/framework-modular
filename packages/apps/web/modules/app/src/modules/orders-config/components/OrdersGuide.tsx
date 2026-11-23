import { observer } from "mobx-react-lite";
import { BoardArt, DispatchArt, GuideFigure, HubArt, TeamArt, TimelineArt } from "@/components/configuration/GuideFigure";
import { PROFILE_DEFAULTS } from "../constants";
import type { OrdersConfigState, OrdersConfigStep } from "../types";

const deliveryChannels = ["delivery", "pickup", "on_site"] as const;
const channelNames = { pickup: "Retiro", delivery: "Domicilio", on_site: "En sitio" };
const confirmationNames = { manual: "Manual", automatic: "Automática", agent: "Por agente" };

export const OrdersGuide = observer(({ step, state }: { step: OrdersConfigStep; state: OrdersConfigState }) => {
  const profile = PROFILE_DEFAULTS[state.profile];
  const channels = state.modalities.map((id) => channelNames[id]).join(", ");
  const modalityCount = (count: number) => count === 1 ? "1 modalidad" : `${count} modalidades`;
  const mode = confirmationNames[state.fulfillment.confirmationMode];
  const teamSize = state.operators.length;
  switch (step) {
    case "profile":
      return <GuideFigure title="El perfil fija los valores iniciales"
        description={`Al elegir «${profile.name}», se cargan sus modalidades de entrega, reglas y tiempos sugeridos. Puedes ajustarlos en los siguientes pasos.`}
        alternative={`Ficha del negocio con los valores sugeridos del perfil: ${profile.modalities.length} modalidades y ${profile.sla.preparationMinutes} minutos de preparación.`}>
        <BoardArt label="PEDIDOS" title={profile.name} icon="store" items={[
          { label: "Modalidades iniciales", value: modalityCount(profile.modalities.length), icon: "route" },
          { label: "Preparación", value: `${profile.sla.preparationMinutes} min`, icon: "time" },
          { label: "Confirmación inicial", value: confirmationNames[profile.fulfillment.confirmationMode ?? "manual"], icon: "check" },
        ]} />
      </GuideFigure>;
    case "modalities":
      return <GuideFigure title="Un pedido, distintas formas de entrega"
        description={`Las rutas marcadas corresponden a tus modalidades activas: ${channels}. Puedes combinar varias según cómo atiendes a tus clientes.`}
        alternative={`El módulo conecta las tres modalidades de entrega. Modalidades habilitadas: ${channels}.`}>
        <HubArt icon="box" items={deliveryChannels.map((id) => ({
          label: channelNames[id], value: state.modalities.includes(id) ? "HABILITADA" : "DESACTIVADA",
          active: state.modalities.includes(id), icon: id === "delivery" ? "route" : id === "pickup" ? "box" : "store",
        }))} />
      </GuideFigure>;
    case "fulfillment": {
      const { confirmationMode, riskThresholdActive, maxShippingCostRisk } = state.fulfillment;
      const explanation = {
        manual: "Un operador revisa cada pedido antes de prepararlo.",
        automatic: "Los pedidos pasan automáticamente a preparación.",
        agent: "El agente verifica los detalles con el cliente antes de confirmar el pedido.",
      }[confirmationMode];
      const shippingRule = riskThresholdActive
        ? `Si el flete supera ${maxShippingCostRisk.toLocaleString("es-CO")} COP, se requiere aprobación manual.`
        : "";
      return <GuideFigure title="La confirmación precede a la preparación"
        description={[explanation, shippingRule].filter(Boolean).join(" ")}
        alternative={`Un comprobante pasa por la confirmación ${mode.toLowerCase()} antes de llegar a preparación.`}>
        <DispatchArt mode={mode} freight={riskThresholdActive ? `Tope: $${maxShippingCostRisk.toLocaleString("es-CO")}` : "Pasar a preparación"}
          carrier={state.modalities.includes("delivery") ? `${state.fulfillment.carriers.filter((c) => c.enabled).length} activas · ${state.fulfillment.carriers.find((c) => c.isDefault)?.name ?? "Sin favorita"}` : undefined} />
      </GuideFigure>;
    }
    case "sla": {
      const { confirmationMinutes, preparationMinutes, dispatchMinutes, urgencyThresholdMinutes } = state.sla;
      return <GuideFigure title="Cada etapa tiene su propio plazo"
        description={`El panel muestra tus tiempos objetivo en minutos. El umbral de urgencia se configura aparte: ${urgencyThresholdMinutes} min en cola.`}
        alternative={`Confirmar: ${confirmationMinutes} minutos. Preparar: ${preparationMinutes}. Despachar: ${dispatchMinutes}.`}>
        <TimelineArt times={[confirmationMinutes, preparationMinutes, dispatchMinutes]} urgency={urgencyThresholdMinutes} />
      </GuideFigure>;
    }
    case "operators":
      return <GuideFigure title={teamSize ? "El equipo que gestiona los pedidos" : "Puedes empezar como administrador"}
        description={teamSize ? `Tienes ${teamSize} ${teamSize === 1 ? "operador registrado" : "operadores registrados"}. Cada persona se identifica con el correo que indiques en su ficha.` : "Puedes gestionar los pedidos directamente. Agrega un nombre y un correo cuando necesites incorporar a otra persona."}
        alternative={`Credenciales del equipo de pedidos. Operadores adicionales: ${teamSize}.`}>
        <TeamArt names={state.operators.slice(-2).map((operator) => operator.name)} total={teamSize} />
      </GuideFigure>;
    case "review":
      return <GuideFigure title="La ficha que vas a guardar"
        description={`Este resumen reúne el perfil «${profile.name}», tus modalidades y el equipo. Guarda al final del paso para marcar Pedidos como preparado en este navegador.`}
        alternative={`Una hoja de revisión muestra ${state.modalities.length} modalidades, confirmación ${mode.toLowerCase()} y ${teamSize} operadores.`}>
        <BoardArt label="REVISIÓN DE PEDIDOS" title="Ficha del negocio" icon="file" metric={profile.name} items={[
          { label: "Entrega", value: modalityCount(state.modalities.length), icon: "route" },
          { label: "Confirmación", value: mode, icon: "check" },
          { label: "Equipo", value: `${teamSize} ${teamSize === 1 ? "operador" : "operadores"}`, icon: "key" },
        ]} />
      </GuideFigure>;
  }
});
