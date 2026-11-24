import { AccessError, type AccessErrorKind } from "@/modules/business-access";
import type {
  CancellationStage,
  CarrierConfig,
  ConfirmationExpiryAction,
  ConfirmationMode,
  ModalityType,
  OnSiteMode,
  OrderOperatorStage,
  OrdersConfigStep,
  OrdersProfileId,
  OutOfHoursPolicy,
  PaymentMethodId,
  PedidosApiResponse,
  PedidosOperatorView,
  PickupScheduleMode,
  ShippingPricingMode,
} from "../types";

/**
 * HTTP client for the `/pedidos` routes of `necto-api`.
 * Every request sends the business-access bearer token (refreshed once by `adminAccessStore.withToken` on 401).
 * Defaults to `/api/pedidos` (rewritten by Vite dev proxy); override with `VITE_PEDIDOS_API_URL` in deployed environments.
 */
const BASE_URL = (import.meta.env.VITE_PEDIDOS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/pedidos";
const TIMEOUT_MS = 20_000;

export class PedidosError extends AccessError {
  constructor(
    kind: AccessErrorKind,
    status: number | null,
    message: string,
    readonly fields: Record<string, string[]> = {},
    readonly code: string | null = null,
  ) {
    super(kind, status, message);
    this.name = "PedidosError";
  }
}

interface ErrorBody {
  message?: string | string[];
  code?: string;
  fields?: Record<string, string[]>;
}

function kindOf(status: number, code: string | undefined): AccessErrorKind {
  if (status === 400 || status === 409) return "validation";
  if (status === 401) return "session-expired";
  if (status === 403) return code === "reverification-required" ? "reverification-required" : "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  return "server";
}

async function call<T>(path: string, token: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new PedidosError(
      aborted ? "timeout" : "network",
      null,
      aborted ? "The service took too long to respond" : "Could not reach the service",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = ((await response.json().catch(() => null)) as ErrorBody | null) ?? {};
    const text = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? response.statusText);
    throw new PedidosError(kindOf(response.status, body.code), response.status, text, body.fields ?? {}, body.code ?? null);
  }
  return (await response.json()) as T;
}

const root = (businessId: string) => `/pedidos/businesses/${encodeURIComponent(businessId)}`;

export interface ModalitiesBody {
  modalities: ModalityType[];
  onSiteMode: OnSiteMode;
}

export interface FulfillmentBody {
  hasOwnCourier: boolean;
  carriers: Array<Pick<CarrierConfig, "id" | "name" | "enabled" | "isDefault">>;
  pickupMode: PickupScheduleMode;
  confirmationMode: ConfirmationMode;
  whatsappNumber: string;
  riskThresholdActive: boolean;
  maxShippingCostRisk: number;
  shippingPricingMode: ShippingPricingMode;
  flatShippingFee: number;
  freeShippingThreshold: number;
  minimumOrderActive: boolean;
  minimumOrderAmount: number;
}

export interface PaymentsBody {
  methods: PaymentMethodId[];
  requireTransferReceipt: boolean;
  requirePrepaymentBeforePrep: boolean;
  confirmationExpiryAction: ConfirmationExpiryAction;
  cancellationLimit: CancellationStage;
}

export interface SlaBody {
  confirmationMinutes: number;
  preparationMinutes: number;
  dispatchMinutes: number;
  urgencyThresholdMinutes: number;
  outOfHoursPolicy: OutOfHoursPolicy;
  outOfHoursAutoReply: boolean;
  outOfHoursMessage: string;
}

export interface OperatorBody {
  name: string;
  email: string;
  phone: string | null;
  stages: OrderOperatorStage[];
}

export interface ProgressBody {
  currentStep: OrdersConfigStep;
  visitedSteps: OrdersConfigStep[];
}

export interface PedidosApi {
  get(token: string, businessId: string): Promise<PedidosApiResponse>;
  changeProfile(token: string, businessId: string, profile: OrdersProfileId): Promise<PedidosApiResponse>;
  updateModalities(token: string, businessId: string, body: ModalitiesBody): Promise<PedidosApiResponse>;
  updateFulfillment(token: string, businessId: string, body: FulfillmentBody): Promise<PedidosApiResponse>;
  updatePayments(token: string, businessId: string, body: PaymentsBody): Promise<PedidosApiResponse>;
  updateSla(token: string, businessId: string, body: SlaBody): Promise<PedidosApiResponse>;
  createOperator(token: string, businessId: string, body: OperatorBody): Promise<PedidosApiResponse>;
  updateOperator(token: string, businessId: string, operatorId: string, body: OperatorBody): Promise<PedidosApiResponse>;
  deleteOperator(token: string, businessId: string, operatorId: string): Promise<PedidosApiResponse>;
  saveProgress(token: string, businessId: string, body: ProgressBody): Promise<PedidosApiResponse>;
  complete(token: string, businessId: string): Promise<PedidosApiResponse>;
  operator(token: string, businessId: string): Promise<PedidosOperatorView>;
}

export const pedidosApi: PedidosApi = {
  get: (token, businessId) => call<PedidosApiResponse>(root(businessId), token),
  changeProfile: (token, businessId, profile) =>
    call<PedidosApiResponse>(`${root(businessId)}/profile`, token, { method: "PUT", json: { profile } }),
  updateModalities: (token, businessId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/modalities`, token, { method: "PUT", json: body }),
  updateFulfillment: (token, businessId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/fulfillment`, token, { method: "PUT", json: body }),
  updatePayments: (token, businessId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/payments`, token, { method: "PUT", json: body }),
  updateSla: (token, businessId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/sla`, token, { method: "PUT", json: body }),
  createOperator: (token, businessId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/operators`, token, { method: "POST", json: body }),
  updateOperator: (token, businessId, operatorId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/operators/${encodeURIComponent(operatorId)}`, token, {
      method: "PUT",
      json: body,
    }),
  deleteOperator: (token, businessId, operatorId) =>
    call<PedidosApiResponse>(`${root(businessId)}/operators/${encodeURIComponent(operatorId)}`, token, {
      method: "DELETE",
    }),
  saveProgress: (token, businessId, body) =>
    call<PedidosApiResponse>(`${root(businessId)}/progress`, token, { method: "PUT", json: body }),
  complete: (token, businessId) =>
    call<PedidosApiResponse>(`${root(businessId)}/complete`, token, { method: "POST" }),
  operator: (token, businessId) => call<PedidosOperatorView>(`${root(businessId)}/operator`, token),
};
