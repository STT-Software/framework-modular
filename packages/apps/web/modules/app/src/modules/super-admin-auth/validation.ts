/**
 * Validación del formulario. Replica las reglas del backend (DTOs de
 * super-admin-auth) para avisar al instante; el servidor sigue validando.
 * Los mensajes se muestran al usuario, por eso están en español.
 */

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeIdentityDocument(value: string): string {
  return value.replace(/[.\s]/g, "").toUpperCase();
}

export function validateIdentifier(value: string): string | null {
  const identifier = value.trim();
  if (identifier.length < 3) return "Ingresa tu usuario o correo.";
  return null;
}

export function validateLoginPassword(value: string): string | null {
  return value.length === 0 ? "Ingresa tu contraseña." : null;
}

export function validateUsername(value: string): string | null {
  return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(value))
    ? null
    : "Usa de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.";
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? null
    : "Ingresa un correo válido.";
}

export function validateNewPassword(value: string): string | null {
  return value.length >= 8 && value.length <= 72
    ? null
    : "La contraseña debe tener entre 8 y 72 caracteres.";
}

export function validateIdentityDocument(value: string): string | null {
  return /^[A-Z0-9-]{5,20}$/.test(normalizeIdentityDocument(value))
    ? null
    : "Usa de 5 a 20 caracteres: letras, números o guion.";
}
