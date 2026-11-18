import type { ReactNode } from "react";

/** Identificadores que entiende el servicio (en inglés). */
export type SourceId =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "whatsapp"
  | "linkedin"
  | "family"
  | "business"
  | "other";

export interface SourceOption {
  id: SourceId;
  /** Texto que ve la persona. */
  label: string;
}

/** Opciones de "¿Dónde nos conociste?", en el orden de la referencia. */
export const SOURCE_OPTIONS: readonly SourceOption[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "family", label: "Familia" },
  { id: "business", label: "Negocios" },
  { id: "other", label: "Otro" },
];

/*
 * Line glyphs of each source in a 24 × 24 box, in the language of the onboarding art (strokes only, painted by the
 * parent: stroke 1.5, round caps and joins). The same drawing is used by the choice cards and by `SourceArt`.
 */
export const SOURCE_GLYPHS: Record<SourceId, ReactNode> = {
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.8" cy="7.2" r="0.6" />
    </>
  ),
  tiktok: <path d="M14 4v11a3.5 3.5 0 1 1-3.5-3.5M14 4c0 2.8 1.9 4.7 4.7 4.7" />,
  facebook: <path d="M15 4h-2a3.5 3.5 0 0 0-3.5 3.5V20M7 11h7" />,
  youtube: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="4" />
      <path d="M10.5 9.5 15 12l-4.5 2.5Z" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M5 19l1.1-3.6A8 8 0 1 1 8.6 18Z" />
      <path d="M9.6 9.4c.3 2.4 2.3 4.4 4.7 4.8l1-1.2" />
    </>
  ),
  linkedin: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8.5 11v5M8.5 8v.01M12 16v-3a2 2 0 0 1 4 0v3M12 11v5" />
    </>
  ),
  family: (
    <>
      <path d="M5 11 12 5l7 6v8H5Z" />
      <path d="M12 16.5s-2.5-1.5-2.5-3a1.3 1.3 0 0 1 2.5-.6 1.3 1.3 0 0 1 2.5.6c0 1.5-2.5 3-2.5 3Z" />
    </>
  ),
  business: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </>
  ),
};

/** Icon of a choice card: the source glyph drawn with the onboarding line style. */
export function SourceIcon({ id }: { id: SourceId }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SOURCE_GLYPHS[id]}
    </svg>
  );
}
