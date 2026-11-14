import { categoryLabel } from "./catalog";
import type { Business, BusinessInput, CategoryId, ModuleId } from "./types";

/** What the form holds while it is being filled in: everything as text, nothing "null". */
export interface BusinessDraft {
  name: string;
  legalName: string;
  taxId: string;
  phone: string;
  supportEmail: string;
  address: string;
  website: string;
  category: CategoryId | "";
  categoryOther: string;
  currency: string;
  timezone: string;
  modules: ModuleId[];
  boss: { name: string; email: string } | null;
}

export type DraftErrors = Partial<Record<DraftField, string>>;

export type DraftField =
  | "name"
  | "legalName"
  | "taxId"
  | "phone"
  | "supportEmail"
  | "address"
  | "website"
  | "category"
  | "categoryOther"
  | "currency"
  | "timezone"
  | "modules"
  | "boss";

export const EMPTY_DRAFT: BusinessDraft = {
  name: "",
  legalName: "",
  taxId: "",
  phone: "",
  supportEmail: "",
  address: "",
  website: "",
  category: "",
  categoryOther: "",
  currency: "COP",
  timezone: "America/Bogota",
  modules: [],
  boss: null,
};

/** The identity fields of the first step, in the order the page shows them (to focus the first wrong one). */
export const IDENTITY_FIELDS: DraftField[] = ["name", "legalName", "taxId", "phone", "supportEmail", "address", "website", "category", "categoryOther"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TAX_ID = /^[A-Za-z0-9][A-Za-z0-9.-]{3,19}$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim()) && value.trim().length <= 254;
}

/** Checks the first step (identity). Returns an error per wrong field; empty when everything is fine. */
export function validateIdentity(draft: BusinessDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.name.trim().length < 2) errors.name = "Escribe un nombre de al menos 2 caracteres.";
  const taxId = draft.taxId.replace(/\s+/g, "");
  if (taxId && !TAX_ID.test(taxId)) errors.taxId = "El NIT debe tener de 4 a 20 caracteres: letras, números, puntos o guiones.";
  const digits = draft.phone.replace(/\D/g, "");
  if (draft.phone.trim() && (digits.length < 7 || digits.length > 15)) errors.phone = "Escribe un teléfono de contacto válido.";
  if (draft.supportEmail.trim() && !isEmail(draft.supportEmail)) errors.supportEmail = "Revisa el formato del correo electrónico.";
  if (draft.website.trim() && !/^https?:\/\/\S+\.\S+/i.test(draft.website.trim())) {
    errors.website = "Escribe una dirección que empiece con https:// o http://.";
  }
  if (!draft.category) errors.category = "Selecciona una categoría para tu negocio.";
  if (draft.category === "other" && draft.categoryOther.trim().length < 2) errors.categoryOther = "Escribe la categoría de tu negocio.";
  return errors;
}

export function validateBoss(boss: { name: string; email: string }): { name?: string; email?: string } {
  const errors: { name?: string; email?: string } = {};
  if (boss.name.trim().length < 2) errors.name = "Escribe el nombre del responsable.";
  if (!isEmail(boss.email)) errors.email = "Escribe un correo electrónico válido.";
  return errors;
}

const orNull = (value: string): string | null => value.trim() || null;

/** The body for the service. Only call it once the draft is valid (it has a category and a boss). */
export function toInput(draft: BusinessDraft): BusinessInput {
  if (!draft.category || !draft.boss) throw new Error("The draft is not complete");
  return {
    name: draft.name.trim(),
    legalName: orNull(draft.legalName),
    taxId: orNull(draft.taxId.replace(/\s+/g, "")),
    phone: orNull(draft.phone),
    address: orNull(draft.address),
    supportEmail: orNull(draft.supportEmail.toLowerCase()),
    website: orNull(draft.website),
    category: draft.category,
    categoryOther: draft.category === "other" ? orNull(draft.categoryOther) : null,
    currency: draft.currency,
    timezone: draft.timezone,
    modules: draft.modules,
    boss: { name: draft.boss.name.trim(), email: draft.boss.email.trim().toLowerCase() },
  };
}

export function fromBusiness(business: Business): BusinessDraft {
  return {
    name: business.name,
    legalName: business.legalName ?? "",
    taxId: business.taxId ?? "",
    phone: business.phone ?? "",
    supportEmail: business.supportEmail ?? "",
    address: business.address ?? "",
    website: business.website ?? "",
    category: business.category,
    categoryOther: business.categoryOther ?? "",
    currency: business.currency,
    timezone: business.timezone,
    modules: [...business.modules],
    boss: { name: business.boss.name, email: business.boss.email },
  };
}

/** The label of the draft's category ("" while none is chosen). */
export function draftCategoryLabel(draft: BusinessDraft): string {
  return draft.category ? categoryLabel(draft.category, draft.categoryOther.trim() || null) : "";
}

const SERVER_FIELD: Record<string, DraftField> = {
  name: "name",
  legalName: "legalName",
  taxId: "taxId",
  phone: "phone",
  address: "address",
  supportEmail: "supportEmail",
  website: "website",
  category: "category",
  categoryOther: "categoryOther",
  currency: "currency",
  timezone: "timezone",
  modules: "modules",
  boss: "boss",
  "boss.name": "boss",
  "boss.email": "boss",
};

const SERVER_FIELD_MESSAGE: Record<DraftField, string> = {
  name: "Revisa el nombre del negocio.",
  legalName: "Revisa la razón social.",
  taxId: "Revisa el NIT o ID fiscal.",
  phone: "Revisa el teléfono de contacto.",
  supportEmail: "Revisa el correo de asistencia.",
  address: "Revisa la dirección.",
  website: "Revisa el sitio web.",
  category: "Revisa la categoría.",
  categoryOther: "Revisa la categoría que escribiste.",
  currency: "Revisa la moneda.",
  timezone: "Revisa la zona horaria.",
  modules: "Revisa los módulos elegidos.",
  boss: "Revisa el nombre y el correo del jefe de negocio.",
};

/** Turns the fields the service rejected into messages for the form. Unknown fields are ignored. */
export function serverFieldErrors(fields: Record<string, string[]>): DraftErrors {
  const errors: DraftErrors = {};
  for (const path of Object.keys(fields)) {
    const field = SERVER_FIELD[path];
    if (field) errors[field] = SERVER_FIELD_MESSAGE[field];
  }
  return errors;
}

/** Which step holds a field, so the form can go back to the first one with an error. */
export function stepOf(field: DraftField): 0 | 1 | 2 {
  if (field === "modules") return 1;
  if (field === "boss") return 2;
  return 0;
}
