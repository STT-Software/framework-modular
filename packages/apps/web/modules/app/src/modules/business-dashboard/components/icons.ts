/** Trazos (24x24) de los iconos de la referencia. Salen del propio código, no de datos de la persona. */
export const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  queue: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  tickets: '<rect x="7" y="3" width="14" height="15" rx="2"/><path d="M4 7H3v14h14v-1M11 7h6m-6 4h6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2"/>',
  settings:
    '<path d="m9 3 1-1h4l1 3 3 2 3-1 2 4-2 3v3l-3 2-1 3h-5l-2-3-3-1-3 1-2-4 2-3V8l3-2 2-3Z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3m0 3h.01"/>',
  logout: '<path d="M9 4H4v16h5m5-13 5 5-5 5m-7-5h12"/>',
  menu: '<path d="M4 6h16M4 12h11M4 18h16"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-12 9h4m-1 3h2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  share: '<path d="M12 16V3m-4 4 4-4 4 4M4 13v8h16v-8"/>',
  display: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  download: '<path d="M12 3v13m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  message: '<path d="M21 11a9 9 0 0 1-9 9H4l-1 2V11a9 9 0 0 1 18 0Z"/><path d="M7 10h10m-10 4h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-10h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  building: '<path d="M5 21V3h14v18M2 21h20M9 7h1m4 0h1m-6 4h1m4 0h1M9 21v-6h6v6"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 1 8M20 3v5h-5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 13 8-13 8V4Z"/>',
} as const;
export type IconName = keyof typeof ICONS;
export interface ModuleDescriptor {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: "blue" | "orange" | "purple" | "green" | "amber" | "cyan";
  icon: string;
}
/** El aspecto de cada módulo (color, icono y etiquetas). Qué módulos tiene un negocio y cómo van lo dice el servidor. */
export const MODULE_CATALOG: ModuleDescriptor[] = [
  {
    id: "reservas",
    name: "Reservas",
    description: "Administra la disponibilidad de mesas, espacios o servicios.",
    tags: ["Disponibilidad", "Confirmaciones"],
    color: "blue",
    icon: "<rect x='4' y='5' width='16' height='16' rx='3'/><path d='M8 3v4m8-4v4M4 10h16m-9 5 2 2 4-4'/>",
  },
  {
    id: "turnos",
    name: "Turnos",
    description: "Organiza las filas y los llamados de atención en tiempo real.",
    tags: ["Fila en vivo", "Pantalla de sala"],
    color: "orange",
    icon: "<path d='M8 5h12M8 12h12M8 19h12'/><circle cx='3' cy='5' r='1'/><circle cx='3' cy='12' r='1'/><circle cx='3' cy='19' r='1'/>",
  },
  {
    id: "agendamiento",
    name: "Agendamiento",
    description: "Programa citas por profesional, horario y disponibilidad.",
    tags: ["Calendario", "Profesionales"],
    color: "purple",
    icon: "<rect x='3' y='5' width='14' height='16' rx='3'/><path d='M7 3v4m6-4v4M3 10h14'/><circle cx='17' cy='16' r='5'/><path d='M17 13v3l2 1'/>",
  },
  {
    id: "referidos",
    name: "Referidos",
    description: "Convierte las recomendaciones en nuevas conexiones.",
    tags: ["Invitaciones", "Seguimiento"],
    color: "green",
    icon: "<circle cx='9' cy='7' r='3'/><path d='M3 20v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m2 5h4m-2-2v4'/>",
  },
  {
    id: "inventario",
    name: "Inventario",
    description: "Controla los productos, sus existencias y movimientos.",
    tags: ["Stock", "Movimientos"],
    color: "amber",
    icon: "<path d='m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9v10M3 8l9 5 9-5M7 5.8l9 5'/>",
  },
  {
    id: "pedidos",
    name: "Pedidos",
    description: "Organiza cada pedido desde la solicitud hasta la entrega.",
    tags: ["Estados", "Entregas"],
    color: "cyan",
    icon: "<path d='M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-8 7 3 3 5-5'/>",
  },
];
export const moduleDescriptor = (id: string): ModuleDescriptor | undefined => MODULE_CATALOG.find((module) => module.id === id);
/** Los colores de una fila (los mismos identificadores que el servidor). */
export const QUEUE_HEX: Record<string, string> = {
  orange: "#f04420",
  purple: "#7a5af8",
  blue: "#2e90fa",
  green: "#12b76a",
  pink: "#ee46bc",
  amber: "#f79009",
};
