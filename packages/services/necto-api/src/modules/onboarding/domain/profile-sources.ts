/**
 * Where the user says they met Necto. The API uses these English identifiers; the
 * frontend shows them translated ("family" -> "Familia").
 */
export const PROFILE_SOURCES = [
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'whatsapp',
  'linkedin',
  'family',
  'business',
  'other',
] as const;

export type ProfileSource = (typeof PROFILE_SOURCES)[number];

/** Longest free text accepted for the "other" source. */
export const SOURCE_OTHER_MAX_LENGTH = 80;

/**
 * The free text worth keeping for a choice of sources: only with "other", trimmed, and null when empty.
 * With any other choice the text is dropped, so a stale "other" answer never survives a change of mind.
 */
export function sourceOtherFor(sources: readonly ProfileSource[], raw: string | null | undefined): string | null {
  if (!sources.includes('other') || typeof raw !== 'string') return null;
  const text = raw.trim();
  return text === '' ? null : text.slice(0, SOURCE_OTHER_MAX_LENGTH);
}
