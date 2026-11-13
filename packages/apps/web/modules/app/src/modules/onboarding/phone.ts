export interface Country {
  /** Indicativo sin el "+" (57 para Colombia). */
  dialCode: string;
  /** Texto del selector: código del país + indicativo. */
  label: string;
}

/** Países disponibles en el selector. El primero es el que viene marcado. */
export const COUNTRIES: readonly Country[] = [
  { dialCode: "57", label: "CO +57" },
  { dialCode: "52", label: "MX +52" },
  { dialCode: "34", label: "ES +34" },
  { dialCode: "54", label: "AR +54" },
  { dialCode: "51", label: "PE +51" },
  { dialCode: "56", label: "CL +56" },
  { dialCode: "593", label: "EC +593" },
  { dialCode: "1", label: "US +1" },
];

export const DEFAULT_DIAL_CODE = COUNTRIES[0].dialCode;

const MIN_NATIONAL_DIGITS = 7;
/** E.164: el número completo (indicativo + número) no pasa de 15 dígitos. */
const MAX_TOTAL_DIGITS = 15;

export const PHONE_FORMAT_ERROR = "Ingresa un número válido, sin el indicativo del país.";

export interface PhoneCheck {
  /** Teléfono en E.164 listo para enviar, o null si no es válido. */
  e164: string | null;
  error: string | null;
}

/** Valida lo que escribió la persona (mismas reglas que el servicio) y arma el número en E.164. */
export function checkPhone(dialCode: string, rawNumber: string): PhoneCheck {
  const raw = rawNumber.trim();
  const digits = raw.replace(/\D/g, "");
  const validChars = /^[\d\s().-]+$/.test(raw);
  if (!validChars || digits.length < MIN_NATIONAL_DIGITS || digits.length + dialCode.length > MAX_TOTAL_DIGITS) {
    return { e164: null, error: PHONE_FORMAT_ERROR };
  }
  return { e164: `+${dialCode}${digits}`, error: null };
}

/** Separa un teléfono E.164 guardado en indicativo y número, para rellenar el formulario. */
export function splitPhone(e164: string | null): { dialCode: string; number: string } {
  if (!e164) return { dialCode: DEFAULT_DIAL_CODE, number: "" };
  const match = [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => e164.startsWith(`+${country.dialCode}`));
  // Un indicativo que ya no está en la lista no se puede mostrar en el selector.
  if (!match) return { dialCode: DEFAULT_DIAL_CODE, number: "" };
  return { dialCode: match.dialCode, number: e164.slice(match.dialCode.length + 1) };
}
