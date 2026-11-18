import { WEEK_DAYS, type DaySchedule, type WeekDay, type WeekSchedule } from "./types";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const cloneSchedule = (schedule: WeekSchedule): WeekSchedule => structuredClone(schedule);

/** Un día abierto con una franja, para "Lu–Vi · 08–18" y "Todos · 08–18". */
export const workday = (): DaySchedule => ({ open: true, ranges: [{ start: "08:00", end: "18:00" }] });

/** El texto de un día: "08:00–12:00 · 14:00–18:00" o "Cerrado". */
export function dayText(day: DaySchedule): string {
  return day.open ? day.ranges.map((range) => `${range.start || "—"}–${range.end || "—"}`).join(" · ") : "Cerrado";
}

export interface HoursProblem {
  day: WeekDay;
  /** Franja con el problema (para marcar su campo de cierre). */
  index: number;
  message: string;
}

/**
 * Las mismas reglas que valida el servidor (que sigue siendo quien decide): un día abierto necesita franjas, cada una con
 * apertura y cierre, el cierre es posterior a la apertura del mismo día y las franjas de un día no se solapan.
 * Las horas son del negocio (su zona horaria); aquí no se convierte nada.
 */
export function hoursProblems(schedule: WeekSchedule): HoursProblem[] {
  const problems: HoursProblem[] = [];
  for (const [day, label] of WEEK_DAYS) {
    const value = schedule[day];
    if (!value.open) continue;
    if (value.ranges.length === 0) {
      problems.push({ day, index: 0, message: `Agrega al menos una franja para ${label}.` });
      continue;
    }
    let found = false;
    value.ranges.forEach((range, index) => {
      if (found) return;
      if (!TIME.test(range.start) || !TIME.test(range.end)) {
        problems.push({ day, index, message: "Completa la apertura y el cierre de cada franja." });
        found = true;
      } else if (range.end <= range.start) {
        problems.push({ day, index, message: "El cierre debe ser posterior a la apertura del mismo día." });
        found = true;
      }
    });
    if (found) continue;
    const sorted = value.ranges.map((range, index) => ({ ...range, index })).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        problems.push({ day, index: sorted[i].index, message: "Las franjas de este día se superponen." });
        break;
      }
    }
  }
  return problems;
}

/** Nombre de un día a partir de la ruta de un error del servidor (`schedule.mon.ranges.1.end`). */
export function problemsFromFields(fields: Record<string, string[]>): HoursProblem[] {
  const result: HoursProblem[] = [];
  for (const [path, messages] of Object.entries(fields)) {
    const match = /(?:^|\.)(mon|tue|wed|thu|fri|sat|sun)(?:\.ranges\.(\d+))?/.exec(path);
    if (match) result.push({ day: match[1] as WeekDay, index: Number(match[2] ?? 0), message: translateServerMessage(messages[0]) });
  }
  return result;
}

function translateServerMessage(message: string): string {
  if (/overlap/i.test(message)) return "Las franjas de este día se superponen.";
  if (/later than the opening/i.test(message)) return "El cierre debe ser posterior a la apertura del mismo día.";
  if (/at least one range/i.test(message)) return "Agrega al menos una franja.";
  if (/at most/i.test(message)) return "Un día admite como máximo 6 franjas.";
  return "Revisa las franjas de este día.";
}
