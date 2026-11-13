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
