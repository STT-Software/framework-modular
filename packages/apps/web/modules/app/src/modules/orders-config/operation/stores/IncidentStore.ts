import { makeAutoObservable } from "mobx";

import {
  createSeedIncidents,
  validateResolution,
  type ResolutionInput,
  type Incident,
  type Resolution,
} from "../domain/incidentDomain";

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

function readStoredIncidents(key: string): Incident[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Incident[]) : null;
  } catch {
    return null;
  }
}

function writeStoredIncidents(key: string, incidents: Incident[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(incidents));
  } catch {
    // Ignore storage quota or restricted-mode errors.
  }
}

export class IncidentStore {
  incidents: Incident[] = [];

  private readonly businessId?: string;

  constructor(businessId?: string) {
    this.businessId = businessId;
    makeAutoObservable<IncidentStore, "businessId">(this, {
      businessId: false,
    });
    this.reload();
  }

  private get storageKey(): string | null {
    return this.businessId ? `necto.pedidos.incidents.${this.businessId}` : null;
  }

  private persist(): void {
    const key = this.storageKey;
    if (!key) return;
    writeStoredIncidents(key, this.incidents);
  }

  reload(): void {
    const key = this.storageKey;
    if (key) {
      const stored = readStoredIncidents(key);
      if (stored) {
        this.incidents = stored;
        return;
      }
      this.incidents = createSeedIncidents();
      this.persist();
      return;
    }

    this.incidents = createSeedIncidents();
  }

  resetDemo(): void {
    this.incidents = createSeedIncidents();
    this.persist();
  }

  record(
    input: Pick<
      Incident,
      | "orderNumber"
      | "customer"
      | "carrier"
      | "trackingNumber"
      | "reason"
      | "address"
      | "phone"
      | "city"
    >,
  ): void {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `inc-${Date.now()}-${this.incidents.length + 1}`;

    this.incidents.unshift({
      ...input,
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    this.persist();
  }

  get pendingCount(): number {
    return this.incidents.filter((incident) =>
      ["pending", "open", "rejected"].includes(incident.status),
    ).length;
  }

  byId(id: string): Incident | undefined {
    return this.incidents.find((n) => n.id === id);
  }

  byOrder(orderNumber: string): Incident[] {
    const needle = orderNumber.trim().toLowerCase();
    return this.incidents.filter(
      (n) => n.orderNumber.trim().toLowerCase() === needle,
    );
  }

  byTracking(trackingNumber: string): Incident[] {
    const needle = trackingNumber.trim().toLowerCase();
    if (!needle) return [];
    return this.incidents
      .filter((n) => n.trackingNumber.trim().toLowerCase() === needle)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  openIncident(id: string): void {
    const n = this.byId(id);
    if (n?.status === "pending") {
      n.status = "open";
      this.persist();
    }
  }

  resolveIncident(id: string, data: ResolutionInput): Result<Incident> {
    const incident = this.byId(id);
    if (!incident) return { ok: false, error: "La novedad ya no existe." };
    if (incident.status === "resolved") {
      return { ok: false, error: "Esta novedad ya está solucionada." };
    }
    if (incident.status === "waiting") {
      return {
        ok: false,
        error: "Está en manos de la transportadora. Espera su respuesta.",
      };
    }

    const errors = validateResolution(data);
    if (errors.length > 0) return { ok: false, error: errors.join(" ") };

    const resolution = data.resolution as Resolution;
    incident.resolution = resolution;
    incident.notes = data.notes.trim();
    incident.recipientName = data.recipientName?.trim();
    incident.recipientPhone = data.recipientPhone?.trim() || undefined;
    incident.status = "resolved";
    incident.resolvedAt = new Date().toISOString();

    incident.retryDate =
      resolution === "date" ? data.retryDate?.trim() : undefined;
    incident.newAddress =
      resolution === "new_address" ? data.newAddress?.trim() : undefined;
    incident.newCity =
      resolution === "change_city" ? data.newCity?.trim() : undefined;

    this.persist();
    return { ok: true, value: incident };
  }
}
