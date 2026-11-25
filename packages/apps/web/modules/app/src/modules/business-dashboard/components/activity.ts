const ACTIVITY_VERB: Record<string, string> = {
  created: "fue creado",
  called: "entró en atención",
  completed: "fue completado",
  cancelled: "fue cancelado",
  "no-show": "quedó como ausente",
  released: "volvió a la fila",
};
/** Una frase de lo que pasó, a partir de un evento del turno. */
export const activityText = (type: string, code: string, queue: string, automatic: boolean): string =>
  `${code} ${ACTIVITY_VERB[type] ?? "cambió"}${automatic && type === "called" ? " automáticamente" : ""} · ${queue}`;
