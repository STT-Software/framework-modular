import type { QueueColor, TurnosProfileId } from "../types";

/** Trazos (24x24) de los iconos de la referencia. Salen del propio código, no de datos de la persona. */
export const ICONS = {
  queue: "<path d='M5 6h14M5 12h14M5 18h9'/>",
  edit: "<path d='m16 3 5 5-12 12-6 1 1-6L16 3Z M13 6l5 5'/>",
  trash: "<path d='M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'/>",
  lock: "<rect x='4' y='10' width='16' height='11' rx='3'/><path d='M8 10V7a4 4 0 0 1 8 0v3m-4 5v2'/>",
  moduleSymbol: "<path d='M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6'/>",
  info: "<circle cx='12' cy='12' r='9'/><path d='M12 8v5m0 3h.01'/>",
} as const;

export const PROFILE_ICONS: Record<TurnosProfileId, string> = {
  clinic: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8m-4-4h8"/>',
  restaurant: '<path d="M4 3v7m3-7v7m3-7v7M4 7h6m-3 3v11M18 3v18m0-18c-4 2-4 8 0 9"/>',
  bank: '<path d="m3 9 9-6 9 6H3Zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
  salon: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  custom: '<path d="M12 4v16M4 12h16"/>',
};

/** El nombre de cada color de fila y su tono, como en el selector de la referencia. */
export const QUEUE_COLOR_CHOICES: ReadonlyArray<{ id: QueueColor; name: string; hex: string }> = [
  { id: "orange", name: "Naranja", hex: "#f04420" },
  { id: "purple", name: "Morado", hex: "#7a5af8" },
  { id: "blue", name: "Azul", hex: "#2e90fa" },
  { id: "green", name: "Verde", hex: "#12b76a" },
  { id: "pink", name: "Rosa", hex: "#ee46bc" },
  { id: "amber", name: "Ámbar", hex: "#f79009" },
];

export const colorHex = (color: QueueColor): string => (QUEUE_COLOR_CHOICES.find((choice) => choice.id === color) ?? QUEUE_COLOR_CHOICES[0]).hex;
