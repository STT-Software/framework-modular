import { BusinessesError } from "./api/businessesApi";

/** User-facing Spanish message mapped from a service error kind, with an optional fallback. */
export function businessErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (error instanceof BusinessesError) {
    switch (error.kind) {
      case "rate-limited":
        return error.retryAfterSeconds
          ? `Demasiados intentos. Espera ${waitText(error.retryAfterSeconds)} e inténtalo de nuevo.`
          : "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "unauthorized":
        return "Tu sesión venció. Inicia sesión de nuevo.";
      case "forbidden":
        return "No tienes permiso para hacer esto.";
      case "not-found":
        return "No encontramos este negocio. Puede que ya no exista.";
      case "conflict":
        return "Este negocio cambió mientras lo editabas o la solicitud ya se usó con otros datos. Vuelve a abrirlo e inténtalo de nuevo.";
      case "validation":
        return "Revisa los datos ingresados.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return fallback;
}

function waitText(seconds: number): string {
  if (seconds < 90) return `${seconds} segundos`;
  return `${Math.ceil(seconds / 60)} minutos`;
}
