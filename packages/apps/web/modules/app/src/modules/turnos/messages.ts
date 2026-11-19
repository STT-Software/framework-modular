import { AccessError } from "@/modules/business-access";
import { TurnosError } from "./api/turnosApi";

/** Lo que el servidor dice (en inglés) de un campo, dicho a la persona en español. El servidor sigue siendo quien decide. */
export function translateIssue(field: string, message: string): string {
  if (/already a queue/i.test(message)) return "Ya existe una fila con ese nombre.";
  if (/already belongs to an operator/i.test(message)) return "Este correo ya pertenece a un operador de Turnos en este negocio.";
  if (/cross with the own values of/i.test(message)) {
    const names = [...message.matchAll(/«([^»]+)»/g)].map((match) => `«${match[1]}»`).join(", ");
    return `Estas reglas se cruzan con los valores personalizados de ${names}. Ajusta los límites generales o edita esa fila.`;
  }
  if (/full after being busy|greater than busyLimit/i.test(message)) {
    return field.startsWith("overrides.")
      ? "La fila debe considerarse llena después de estar ocupada. Revisa los valores propios y los generales."
      : "El límite de fila llena debe ser mayor que el de fila ocupada.";
  }
  if (/at most \d+ (queues|operators)/i.test(message)) return "Llegaste al máximo permitido para este negocio.";
  if (field === "name") return "Revisa el nombre: debe tener entre 2 y 60 caracteres (80 para un operador).";
  if (field === "averageMinutes") return "El tiempo promedio debe ser un número entero entre 1 y 1440 minutos.";
  if (field.endsWith("prefix") || field === "fixedPrefix") return "Usa de 1 a 5 letras o números para el prefijo.";
  if (/(urgentMinutes|busyLimit|fullLimit)$/.test(field)) return "Revisa los valores de urgencia y saturación: deben ser números enteros positivos.";
  if (field === "email") return "El correo es obligatorio para el acceso OTP. Revisa su formato.";
  if (field === "phone") return "Revisa el número de teléfono.";
  if (field === "queueIds" || field.startsWith("queueIds")) return "Asigna al menos una fila existente al operador.";
  if (field === "profile") return "Elige un perfil de la lista.";
  return "Revisa los datos indicados.";
}

/** El primer problema por campo que dejó el servidor, ya traducido. */
export function firstIssue(fields: Record<string, string[]>): string | null {
  const [entry] = Object.entries(fields);
  return entry ? translateIssue(entry[0], entry[1][0] ?? "") : null;
}

/** Lo que se le dice a la persona cuando una llamada falla por algo distinto de un dato inválido. */
export function turnosErrorMessage(error: unknown): string {
  if (error instanceof TurnosError && error.code === "concurrent-change") return "Alguien más cambió la configuración al mismo tiempo. Recarga e inténtalo de nuevo.";
  if (error instanceof TurnosError && error.code === "queue-has-operators") {
    return "Es la única fila y tiene operadores. Crea otra fila y reasigna al equipo, o retira a esos operadores antes de eliminarla.";
  }
  if (error instanceof AccessError) {
    switch (error.kind) {
      case "rate-limited":
        return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "not-found":
        return "Este negocio ya no está disponible para ti.";
      case "forbidden":
        return "No tienes permiso para hacer esto.";
      case "validation":
        return "Revisa los datos indicados.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}
