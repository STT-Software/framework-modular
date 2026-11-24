import type { CategoryId, ModuleId } from "@/modules/businesses";

export const WEEK_DAYS = [
  ["mon", "Lunes"],
  ["tue", "Martes"],
  ["wed", "Miércoles"],
  ["thu", "Jueves"],
  ["fri", "Viernes"],
  ["sat", "Sábado"],
  ["sun", "Domingo"],
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number][0];

/** Horas "HH:mm" locales del negocio. Un campo vacío es una franja que aún no se completó (el servidor la rechaza). */
export interface TimeRange {
  start: string;
  end: string;
}
export interface DaySchedule {
  open: boolean;
  ranges: TimeRange[];
}
export type WeekSchedule = Record<WeekDay, DaySchedule>;

export const SETUP_STEPS = ["data", "schedule", "category", "review"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** El estado completo que devuelve `GET /business-setup/businesses/:id` (contrato en el README de necto-api). */
export interface SetupState {
  business: { id: string; status: string; currency: string; timezone: string };
  modules: Array<{
    id: ModuleId;
    name: string;
    description: string;
    schedule: { mode: "inherited" | "custom" };
    /** Reported by each module's setup status source (e.g. Turnos and Pedidos). */
    settings: { status: "pending" | "ready"; summary?: Record<string, number> };
  }>;
  profile: {
    name: string;
    legalName: string | null;
    taxId: string | null;
    phone: string | null;
    supportEmail: string | null;
    address: string | null;
    website: string | null;
    description: string | null;
  };
  category: { id: CategoryId; other: string | null };
  /** Solo para un negocio con Turnos: el perfil de atención que sugiere sus primeras filas (lo guarda Turnos). */
  turnos: {
    profile: string;
    suggested: string;
    profiles: Array<{ id: string; name: string; description: string; suggestedQueues: string[] }>;
  } | null;
  logo: { contentType: string; sizeBytes: number; updatedAt: string; url: string } | null;
  schedule: {
    timezone: string;
    base: { days: WeekSchedule; saved: boolean; openNow: boolean | null };
    modules: Record<string, { inherit: boolean; days: WeekSchedule; ownDays: WeekSchedule | null; openNow: boolean | null }>;
  };
  progress: { currentStep: SetupStep | null; visitedSteps: SetupStep[]; baseReady: boolean; baseReadyAt: string | null };
}

/** Lo que escribe la persona en el formulario "Datos del negocio" (todo texto; vacío = sin valor). */
export interface ProfileForm {
  name: string;
  phone: string;
  supportEmail: string;
  address: string;
  legalName: string;
  taxId: string;
  website: string;
  description: string;
}
