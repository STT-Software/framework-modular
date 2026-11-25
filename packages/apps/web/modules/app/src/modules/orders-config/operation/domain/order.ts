import type { ModalityType } from "../../types";

export const orderStages = {
  new: "Nuevo", confirmed: "Confirmado", preparing: "En preparación",
  ready: "Listo", dispatched: "En camino", delivered: "Entregado", cancelled: "Cancelado",
} as const;
export type Stage = keyof typeof orderStages;
export const modalityNames: Record<ModalityType, string> = {
  delivery: "Domicilio", pickup: "Retiro en local", on_site: "En el establecimiento",
};
export interface Order {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  price: number;
  modality: ModalityType;
  stage: Stage;
  createdAt: number;
  finishedAt?: number;
}
export function total(order: Order) { return order.price * order.quantity; }
export function money(value: number) { return "$ " + value.toLocaleString("es-CO"); }
export function nextStage(order: Order): Stage | undefined {
  switch (order.stage) {
    case "new": return "confirmed";
    case "confirmed": return "preparing";
    case "preparing": return "ready";
    case "ready": return order.modality === "delivery" ? "dispatched" : "delivered";
    case "dispatched": return "delivered";
    default: return undefined;
  }
}
