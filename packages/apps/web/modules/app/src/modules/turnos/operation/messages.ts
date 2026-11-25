import { AccessError } from "@/modules/business-access";
import { TurnosError } from "../api/turnosApi";
import { turnosErrorMessage, translateIssue } from "../messages";
/** Los códigos estables del servidor para la operación, dichos a la persona en español. */
const BY_CODE: Record<string, string> = {
  "queue-paused": "Esta fila está en pausa y no recibe turnos nuevos.",
  "operator-busy": "Ya tienes un turno en atención. Termínalo antes de llamar a otro.",
  "queue-empty": "No hay personas esperando en esta fila.",
  "not-next-in-line": "Esta fila atiende por orden de llegada: este turno todavía no es el siguiente.",
  "ticket-already-taken": "Otra persona del equipo ya llamó a este turno.",
  "invalid-ticket-state": "El turno ya cambió de estado. Se actualizó la pantalla.",
  "view-not-allowed": "Tu perfil no tiene permiso para usar esta vista.",
  "operator-not-operable": "Tu acceso todavía no está activo. Pide al administrador que lo revise.",
  "administrator-required": "Solo el administrador del negocio puede hacer esto.",
  "queue-has-open-turns": "Esta fila todavía tiene turnos esperando o en atención. Termínalos o cancélalos antes de eliminarla.",
  "numbering-busy": "Se crearon muchos turnos al mismo tiempo. Inténtalo de nuevo.",
  "survey-closed": "Esta encuesta ya fue respondida o venció.",
};
/** Un dato de un formulario de turno, dicho en español. */
function issueText(field: string, message: string): string {
  if (field === "customerEmail") return "Revisa el correo del cliente.";
  if (field === "customerPhone") return "Revisa el teléfono del cliente (de 7 a 15 dígitos).";
  if (field === "customerName") return "El nombre del cliente debe tener entre 2 y 80 caracteres.";
  if (field.startsWith("answers.")) {
    const label = /^(.*?) (is required|must )/.exec(message)?.[1];
    return label ? (message.includes("is required") ? `Completa el campo ${label}.` : `Revisa el campo ${label}.`) : "Revisa los datos adicionales de la fila.";
  }
  if (field === "clientRequestId") return "Este envío ya se usó. Vuelve a intentarlo.";
  if (field === "rating") return "Elige una calificación de 1 a 5.";
  return translateIssue(field, message);
}
/** Lo que se le dice a la persona cuando una acción de la operación no se pudo hacer. */
export function operationErrorMessage(error: unknown): string {
  if (error instanceof TurnosError) {
    if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
    const [entry] = Object.entries(error.fields);
    if (entry) return issueText(entry[0], entry[1][0] ?? "");
    if (error.kind === "validation") return "Revisa los datos indicados.";
  }
  if (error instanceof AccessError && error.kind === "forbidden") return "Tu perfil no tiene permiso para hacer esto.";
  return turnosErrorMessage(error);
}
/** Los errores de la operación que significan «la pantalla quedó vieja»: se vuelve a leer lo que muestra. */
export const isStale = (error: unknown): boolean => error instanceof TurnosError && ["invalid-ticket-state", "ticket-already-taken", "queue-empty", "not-next-in-line"].includes(error.code ?? "");
