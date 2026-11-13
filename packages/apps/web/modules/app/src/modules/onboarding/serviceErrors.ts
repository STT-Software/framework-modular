import { OnboardingError } from "./api/onboardingApi";

/** Texto que ve la persona según el tipo de error del servicio (los textos del servidor van en inglés). */
export function serviceErrorMessage(error: unknown): string {
  if (error instanceof OnboardingError) {
    switch (error.kind) {
      case "rate-limited":
        return "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "unauthorized":
        return "Tu sesión venció. Inicia sesión de nuevo.";
      case "validation":
        return "Revisa los datos ingresados.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}
