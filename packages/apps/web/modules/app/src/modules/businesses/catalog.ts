import type { CategoryId, ModuleId } from "./types";

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  description: string;
  tags: [string, string];
  color: "blue" | "orange" | "purple" | "green" | "amber" | "cyan";
  /** Inner SVG of a 24x24 icon. */
  icon: string;
}

/** What each functionality looks like in the interface. The ids are the ones the service accepts. */
export const MODULES: readonly ModuleInfo[] = [
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

export function moduleInfo(id: string): ModuleInfo | undefined {
  return MODULES.find((module) => module.id === id);
}

export const CATEGORIES: readonly { id: CategoryId; name: string }[] = [
  { id: "gastronomy", name: "Gastronomía" },
  { id: "retail", name: "Retail y boutique" },
  { id: "professional-services", name: "Servicios profesionales" },
  { id: "health-wellness", name: "Salud y bienestar" },
  { id: "other", name: "Otra" },
];

/** The text of a business category: the free text when it is "Otra". */
export function categoryLabel(category: CategoryId, other: string | null): string {
  if (category === "other") return other ?? "Otra";
  return CATEGORIES.find((item) => item.id === category)?.name ?? category;
}

export const CURRENCIES = [
  { value: "COP", label: "COP · Peso colombiano" },
  { value: "MXN", label: "MXN · Peso mexicano" },
  { value: "USD", label: "USD · Dólar estadounidense" },
  { value: "EUR", label: "EUR · Euro" },
];

export const TIMEZONES = [
  { value: "America/Bogota", label: "Bogotá · América/Bogotá" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Lima", label: "Lima" },
  { value: "Europe/Madrid", label: "Madrid" },
];

/** A short label to show for a business id: the real id is a long hexadecimal string. */
export function displayId(id: string): string {
  return `NCT-${id.slice(-6).toUpperCase()}`;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}
