import { normalizeEmail, optionalText } from '../../../../platform/text/normalize';

/** Trimmed text; an empty string becomes null so "left blank" and "not sent" mean the same. */
export const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? optionalText(value) : value);
export const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export const asEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);

/** Adds https:// to a website typed without a scheme, so "mishop.co" is accepted. */
export const asWebsite = ({ value }: { value: unknown }) => {
  const text = typeof value === 'string' ? optionalText(value) : value;
  return typeof text === 'string' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? `https://${text}` : text;
};
