import { OnboardingError } from "./api/onboardingApi";

/** Texto del campo cuando otra cuenta ya usa el número. */
export const PHONE_IN_USE_MESSAGE = "Este número ya está registrado con otra cuenta. Usa otro número.";
/** Aviso del paso 1 cuando el paso 2 se envió sin teléfono guardado en el servicio. */
export const PHONE_REQUIRED_MESSAGE = "Antes de seguir, guarda tu número de teléfono.";

/** Otra cuenta ya usa el número. Sin `code` (servicio anterior), cualquier 409 del paso 1 significaba eso. */
export function isPhoneInUseError(error: unknown): boolean {
  return error instanceof OnboardingError && (error.code === "phone-in-use" || (error.kind === "conflict" && error.code === null));
}

/** El servicio no tiene el teléfono: hay que volver al paso 1. */
export function isPhoneRequiredError(error: unknown): boolean {
  return error instanceof OnboardingError && error.code === "phone-required";
}

/** Texto que ve la persona según el error del servicio (los textos del servidor van en inglés). */
export function serviceErrorMessage(error: unknown): string {
  if (error instanceof OnboardingError) {
    switch (error.code) {
      case "phone-in-use":
        return PHONE_IN_USE_MESSAGE;
      case "phone-required":
        return PHONE_REQUIRED_MESSAGE;
    }
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
