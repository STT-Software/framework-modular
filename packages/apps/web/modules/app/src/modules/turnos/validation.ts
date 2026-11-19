import type { OperatorBody, QueueBody, RulesBody } from "./api/turnosApi";
import type { EffectiveRules, OperatorForm, QueueForm, RulesForm, TurnosLimits, TurnosOperator, TurnosQueue, TurnosRules } from "./types";

/**
 * Las mismas reglas que valida el servidor (que sigue siendo quien decide), para avisar al escribir sin esperar la respuesta.
 * Los mensajes van en español porque los ve la persona.
 */

/** Mayúsculas y sin tildes: «  ñu » queda «NU». */
export function normalizePrefix(raw: string): string {
  return raw.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const prefixOk = (value: string, limits: TurnosLimits) => new RegExp(`^[A-Z0-9]{${limits.prefix.min},${limits.prefix.max}}$`).test(value);

/** Vacío es «sin valor propio» (`null`); un número entero es ese número; cualquier otra cosa es inválida (`NaN`). */
export function wholeOrNull(text: string): number | null {
  if (text.trim() === "") return null;
  return /^-?\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

const inRange = (value: number | null, min: number, max: number) => value !== null && Number.isInteger(value) && value >= min && value <= max;

const initialOf = (name: string) => normalizePrefix(name).replace(/[^A-Z0-9]/g, "").slice(0, 1);

/** Lo que una fila usa de verdad: cada valor propio si lo tiene, el general si no, campo por campo. */
export function effectiveFor(queue: { name: string; overrides: TurnosQueue["overrides"] }, rules: TurnosRules): EffectiveRules {
  const own = queue.overrides;
  const prefix = own.prefix ?? (rules.prefixMode === "fixed" ? (rules.fixedPrefix ?? "") : rules.prefixMode === "initial" ? initialOf(queue.name) : "");
  return {
    prefix,
    urgentMinutes: own.urgentMinutes ?? rules.urgentMinutes,
    busyLimit: own.busyLimit ?? rules.busyLimit,
    fullLimit: own.fullLimit ?? rules.fullLimit,
  };
}

export function ticketFor(queue: { name: string; overrides: TurnosQueue["overrides"] }, rules: TurnosRules): string {
  const { prefix } = effectiveFor(queue, rules);
  return `${prefix ? `${prefix}-` : ""}001`;
}

/** Los valores propios de un diálogo de fila, ya leídos. Un número inválido es `NaN`. */
export function overridesOf(form: QueueForm): TurnosQueue["overrides"] {
  const prefix = normalizePrefix(form.prefix);
  return {
    prefix: prefix === "" ? null : prefix,
    urgentMinutes: wholeOrNull(form.urgentMinutes),
    busyLimit: wholeOrNull(form.busyLimit),
    fullLimit: wholeOrNull(form.fullLimit),
  };
}

export function queueProblem(form: QueueForm, context: { rules: TurnosRules; queues: TurnosQueue[]; selfId: string | null; limits: TurnosLimits }): string {
  const { limits } = context;
  const name = form.name.trim();
  if (name.length < limits.queueName.min) return `Escribe un nombre de al menos ${limits.queueName.min} caracteres.`;
  if (name.length > limits.queueName.max) return `El nombre admite hasta ${limits.queueName.max} caracteres.`;
  if (context.queues.some((other) => other.id !== context.selfId && other.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return "Ya existe una fila con ese nombre.";
  const average = wholeOrNull(form.averageMinutes);
  if (!inRange(average, limits.averageMinutes.min, limits.averageMinutes.max)) {
    return `El tiempo promedio debe ser un número entero entre ${limits.averageMinutes.min} y ${limits.averageMinutes.max} minutos.`;
  }
  const own = overridesOf(form);
  if (own.prefix && !prefixOk(own.prefix, limits)) return `Usa de ${limits.prefix.min} a ${limits.prefix.max} letras o números para el prefijo.`;
  for (const key of ["urgentMinutes", "busyLimit", "fullLimit"] as const) {
    const value = own[key];
    if (value !== null && !inRange(value, limits[key].min, limits[key].max)) return "Revisa los valores de urgencia y saturación: deben ser números enteros positivos.";
  }
  const effective = effectiveFor({ name, overrides: own }, context.rules);
  if (effective.fullLimit <= effective.busyLimit) return "La fila debe considerarse llena después de estar ocupada. Revisa los valores propios y los generales.";
  return "";
}

export function rulesFromForm(form: RulesForm): TurnosRules {
  return {
    prefixMode: form.prefixMode,
    fixedPrefix: form.prefixMode === "fixed" ? normalizePrefix(form.fixedPrefix) : null,
    dailyReset: form.dailyReset,
    urgentMinutes: Number(form.urgentMinutes.trim() === "" ? Number.NaN : form.urgentMinutes),
    busyLimit: Number(form.busyLimit.trim() === "" ? Number.NaN : form.busyLimit),
    fullLimit: Number(form.fullLimit.trim() === "" ? Number.NaN : form.fullLimit),
  };
}

export function rulesProblem(form: RulesForm, queues: TurnosQueue[], limits: TurnosLimits): string {
  const rules = rulesFromForm(form);
  if (rules.prefixMode === "fixed" && !prefixOk(rules.fixedPrefix ?? "", limits)) return `Escribe un prefijo general de ${limits.prefix.min} a ${limits.prefix.max} letras o números.`;
  if (!inRange(rules.urgentMinutes, limits.urgentMinutes.min, limits.urgentMinutes.max)) return `La urgencia debe estar entre ${limits.urgentMinutes.min} y ${limits.urgentMinutes.max} minutos.`;
  if (!inRange(rules.busyLimit, limits.busyLimit.min, limits.busyLimit.max) || !inRange(rules.fullLimit, limits.fullLimit.generalMin, limits.fullLimit.max) || rules.fullLimit <= rules.busyLimit) {
    return "El límite de fila llena debe ser mayor que el de fila ocupada.";
  }
  const crossed = queues.find((queue) => {
    const effective = effectiveFor(queue, rules);
    return effective.fullLimit <= effective.busyLimit;
  });
  if (crossed) return `Estas reglas se cruzan con los valores personalizados de «${crossed.name}». Ajusta los límites generales o edita esa fila.`;
  return "";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function operatorProblem(
  form: OperatorForm,
  context: { queues: TurnosQueue[]; operators: TurnosOperator[]; selfId: string | null; limits: TurnosLimits },
): string {
  const { limits } = context;
  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  if (name.length < limits.operatorName.min) return `Escribe un nombre de al menos ${limits.operatorName.min} caracteres.`;
  if (name.length > limits.operatorName.max) return `El nombre admite hasta ${limits.operatorName.max} caracteres.`;
  if (!EMAIL.test(email) || email.length > limits.operatorEmail.max) return "El correo es obligatorio para el acceso OTP. Revisa su formato.";
  if (context.operators.some((other) => other.id !== context.selfId && other.email === email)) return "Este correo ya pertenece a un operador de Turnos en este negocio.";
  if (form.phone.trim() && !new RegExp(`^\\+?[0-9]{${limits.phoneDigits.min},${limits.phoneDigits.max}}$`).test(form.phone.replace(/[\s().-]/g, ""))) {
    return "Revisa el número de teléfono.";
  }
  if (form.queueIds.length === 0 || form.queueIds.some((id) => !context.queues.some((queue) => queue.id === id))) return "Asigna al menos una fila existente al operador.";
  return "";
}

export function queueBody(form: QueueForm): QueueBody {
  const own = overridesOf(form);
  return {
    name: form.name.trim(),
    mode: form.mode,
    averageMinutes: Number(form.averageMinutes),
    color: form.color,
    overrides: { prefix: own.prefix, urgentMinutes: own.urgentMinutes, busyLimit: own.busyLimit, fullLimit: own.fullLimit },
  };
}

export function rulesBody(form: RulesForm): RulesBody {
  const rules = rulesFromForm(form);
  return { ...rules, fixedPrefix: rules.fixedPrefix };
}

export function operatorBody(form: OperatorForm): OperatorBody {
  return { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() === "" ? null : form.phone.trim(), queueIds: form.queueIds };
}

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "N"
  );
}
