/**
 * The six functionalities a business can have enabled. The identifiers are stable (they are stored and used to
 * authorize access); the names and descriptions are product text shown to people, in Spanish.
 * Reservations and scheduling are different modules on purpose.
 */
export const BUSINESS_MODULES = [
  { id: 'reservas', name: 'Reservas', description: 'Disponibilidad y reservas de mesas, espacios o servicios.' },
  { id: 'turnos', name: 'Turnos', description: 'Filas y llamados de atención.' },
  { id: 'agendamiento', name: 'Agendamiento', description: 'Citas por profesional y horario.' },
  { id: 'referidos', name: 'Referidos', description: 'Recomendaciones e invitaciones.' },
  { id: 'inventario', name: 'Inventario', description: 'Productos, existencias y movimientos.' },
  { id: 'pedidos', name: 'Pedidos', description: 'Solicitudes, estados y entregas.' },
] as const;

export type BusinessModuleId = (typeof BUSINESS_MODULES)[number]['id'];
export const BUSINESS_MODULE_IDS = BUSINESS_MODULES.map((module) => module.id) as readonly BusinessModuleId[];

/** Initial categories. "other" needs a free text of its own (`categoryOther`). */
export const BUSINESS_CATEGORIES = [
  { id: 'gastronomy', name: 'Gastronomía' },
  { id: 'retail', name: 'Retail y boutique' },
  { id: 'professional-services', name: 'Servicios profesionales' },
  { id: 'health-wellness', name: 'Salud y bienestar' },
  { id: 'other', name: 'Otra' },
] as const;

export type BusinessCategoryId = (typeof BUSINESS_CATEGORIES)[number]['id'];
export const BUSINESS_CATEGORY_IDS = BUSINESS_CATEGORIES.map((category) => category.id) as readonly BusinessCategoryId[];

export const DEFAULT_CURRENCY = 'COP';
export const DEFAULT_TIMEZONE = 'America/Bogota';
