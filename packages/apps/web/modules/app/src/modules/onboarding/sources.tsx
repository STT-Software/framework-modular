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
  /** Clase del recuadro del icono (colores de cada red). */
  iconClassName: string;
  icon: ReactNode;
}

/** Opciones de "¿Dónde nos conociste?", en el orden de la referencia. */
export const SOURCE_OPTIONS: readonly SourceOption[] = [
  {
    id: "instagram",
    label: "Instagram",
    iconClassName: "ob-icon-instagram",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    iconClassName: "ob-icon-tiktok",
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 4v12.5a4 4 0 1 1-4-4M14 4c0 3 2 5 5 5"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    iconClassName: "ob-icon-facebook",
    icon: <b>f</b>,
  },
  {
    id: "youtube",
    label: "YouTube",
    iconClassName: "ob-icon-youtube",
    icon: (
      <svg width="25" height="22" viewBox="0 0 25 22" fill="none">
        <rect x="1" y="3" width="23" height="16" rx="5" fill="currentColor" />
        <path d="m10 7 7 4-7 4V7Z" fill="white" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    iconClassName: "ob-icon-whatsapp",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 18.5 3 21l4.5-1a9 9 0 1 0-2.5-1.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m8 7 2 3-1.2 1a9 9 0 0 0 4.2 4.2L14 14l3 2c-1 3-4.5 1.5-7-1S6 8 8 7Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    iconClassName: "ob-icon-linkedin",
    icon: <b>in</b>,
  },
  {
    id: "family",
    label: "Familia",
    iconClassName: "ob-icon-neutral",
    icon: (
      <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "business",
    label: "Negocios",
    iconClassName: "ob-icon-neutral",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="7" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a24 24 0 0 0 18 0m-9 0v3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "other",
    label: "Otro",
    iconClassName: "ob-icon-neutral",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.7" fill="currentColor" />
        <circle cx="12" cy="12" r="1.7" fill="currentColor" />
        <circle cx="19" cy="12" r="1.7" fill="currentColor" />
      </svg>
    ),
  },
];
