/** Identifiers of the functionalities a business can enable (the server validates them against its own catalog). */
export type ModuleId = "reservas" | "turnos" | "agendamiento" | "referidos" | "inventario" | "pedidos";

export type CategoryId = "gastronomy" | "retail" | "professional-services" | "health-wellness" | "other";

export type BusinessStatus = "active" | "paused";

/** A business as the service returns it. */
export interface Business {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  supportEmail: string | null;
  website: string | null;
  category: CategoryId;
  categoryOther: string | null;
  currency: string;
  timezone: string;
  modules: ModuleId[];
  status: BusinessStatus;
  boss: { name: string; email: string; assignedAt: string };
  /** `hasActivity` is false until the business has any: nothing is invented. */
  summary: { hasActivity: boolean };
  createdAt: string;
  updatedAt: string;
}

/** The body sent to create or edit a business. */
export interface BusinessInput {
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  supportEmail: string | null;
  website: string | null;
  category: CategoryId;
  categoryOther: string | null;
  currency: string;
  timezone: string;
  modules: ModuleId[];
  boss: { name: string; email: string };
}

export interface BusinessFilters {
  q: string;
  category: CategoryId | "";
  status: BusinessStatus | "";
}

export interface BusinessPage {
  items: Business[];
  total: number;
  page: number;
  pageSize: number;
}

export type DeliveryStatus = "none" | "sending" | "accepted" | "failed";
export type DeliveryFailureCode = "not-configured" | "rejected" | "timeout" | "connection" | "unknown";

/**
 * What is known about the invitation sent to the boss. "accepted" means the mail provider took the message;
 * it never means the person received it (`deliveryConfirmed` is always false).
 */
export interface InvitationStatus {
  status: DeliveryStatus;
  bossEmail: string;
  attemptedAt: string | null;
  acceptedAt: string | null;
  failureCode: DeliveryFailureCode | null;
  expiresAt: string | null;
  expired: boolean;
  deliveryConfirmed: false;
  resendAvailableAt: string | null;
}
