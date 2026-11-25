import type { OrdersConfigStep, OrdersValidationIssue } from "./types";

export type WizardStep = Exclude<OrdersConfigStep, "sla"> | "confirmation";

// The API stores progress using the original seven identifiers.
export function progressStep(step: WizardStep): OrdersConfigStep {
  if (step === "confirmation") return "fulfillment";
  if (step === "fulfillment") return "sla";
  return step;
}

export function issuePanel(issue: OrdersValidationIssue): WizardStep {
  if (issue.step === "sla") return "fulfillment";
  if (issue.step === "fulfillment" && ["whatsappNumber", "maxShippingCostRisk"].includes(issue.field)) return "confirmation";
  return issue.step;
}
export const STEPS: { id: WizardStep; nav: string; short: string; hint: string }[] = [
  { id: "profile", nav: "Perfil del negocio", short: "Perfil", hint: "Rubro y base de operación" },
  { id: "modalities", nav: "Modalidades de entrega", short: "Modalidades", hint: "Domicilio, retiro o en sitio" },
  { id: "confirmation", nav: "Confirmación de pedidos", short: "Confirmación", hint: "Modo de confirmación" },
  { id: "fulfillment", nav: "Envíos y tiempos", short: "Logística", hint: "Canales, tiempos y horarios" },
  { id: "payments", nav: "Pagos y políticas", short: "Pagos", hint: "Métodos y cancelación" },
  { id: "operators", nav: "Operadores", short: "Equipo", hint: "Personal y etapas" },
  { id: "review", nav: "Revisión", short: "Revisión", hint: "Confirmar configuración" },
];

export const COPY: Record<WizardStep, { title: string; description: string; document: string }> = {
  profile: {
    title: "Perfil de pedidos",
    description:
      "El rubro de tu negocio nos ayuda a sugerir las modalidades, transportadoras, reglas de pago y tiempos iniciales.",
    document: "Perfil de Pedidos",
  },
  modalities: {
    title: "Modalidades de entrega",
    description: "Elige las formas en que tus clientes van a recibir o consumir tus productos.",
    document: "Modalidades de Pedidos",
  },
  confirmation: {
    title: "Confirmación de pedidos",
    description:
      "Elige cómo se confirma cada pedido antes de prepararlo.",
    document: "Confirmación de Pedidos",
  },
  payments: {
    title: "Pagos y políticas",
    description:
      "Define los métodos de pago aceptados, las validaciones previas a la preparación y los límites de cancelación.",
    document: "Pagos y políticas",
  },
  fulfillment: {
    title: "Envíos, tiempos y horarios",
    description:
      "Configura las entregas, sus tarifas y los tiempos de atención dentro y fuera de horario.",
    document: "Tiempos de Pedidos",
  },
  operators: {
    title: "Operadores de pedidos",
    description:
      "Asigna operadores a la gestión de pedidos e indica qué etapas operativas atenderá cada persona.",
    document: "Operadores de Pedidos",
  },
  review: {
    title: "Revisar configuración de pedidos",
    description:
      "Revisa tus modalidades, envíos, pagos, tiempos y equipo antes de guardar la configuración de Pedidos.",
    document: "Revisión de Pedidos",
  },
};
