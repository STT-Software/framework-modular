import { registerDecorator, type ValidationOptions } from 'class-validator';

let currencies: ReadonlySet<string> | null = null;

/** ISO 4217 codes the runtime knows (COP, USD, EUR...). */
export function isCurrencyCode(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  currencies ??= new Set(Intl.supportedValuesOf('currency'));
  return currencies.has(value);
}

const IANA_SHAPE = /^(?:UTC|[A-Za-z]+(?:[_-][A-Za-z]+)*(?:\/[A-Za-z0-9]+(?:[_+-][A-Za-z0-9]+)*)+)$/;

/** The canonical IANA name ("America/Bogota") for a time zone, or null if it is not a valid IANA identifier. */
export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || !IANA_SHAPE.test(value)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function IsCurrencyCode(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCurrencyCode',
      target: target.constructor,
      propertyName,
      options: { message: 'currency must be a valid ISO 4217 code, for example COP', ...options },
      validator: { validate: isCurrencyCode },
    });
}

export function IsIanaTimeZone(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isIanaTimeZone',
      target: target.constructor,
      propertyName,
      options: { message: 'timezone must be a valid IANA identifier, for example America/Bogota', ...options },
      validator: { validate: (value: unknown) => canonicalTimeZone(value) !== null },
    });
}
