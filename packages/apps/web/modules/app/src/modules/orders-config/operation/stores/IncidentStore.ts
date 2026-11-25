import { makeAutoObservable } from "mobx";

import {
    validateResolution,
    type ResolutionInput,
    type Incident,
    type Resolution,
} from "../domain/incidentDomain";

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export class IncidentStore {
  incidents: Incident[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  record(input: Pick<Incident, "orderNumber" | "customer" | "carrier" | "trackingNumber" | "reason" | "address" | "phone" | "city">): void {
    this.incidents.unshift({ ...input, id: crypto.randomUUID(), status: "pending", createdAt: new Date().toISOString() });
  }

  get pendingCount(): number {
    return this.incidents.filter(incident => ["pending", "open", "rejected"].includes(incident.status)).length;
  }

  byId(id: string): Incident | undefined {
    return this.incidents.find((n) => n.id === id);
  }

  byOrder(orderNumber: string): Incident[] {
    const needle = orderNumber.trim().toLowerCase();
    return this.incidents.filter((n) => n.orderNumber.trim().toLowerCase() === needle);
  }

  openIncident(id: string): void {
    const n = this.byId(id);
    if (n?.status === "pending") n.status = "open";
  }

  resolveIncident(id: string, data: ResolutionInput): Result<Incident> {
    const incident = this.byId(id);
    if (!incident) return { ok: false, error: "La novedad ya no existe." };
    if (incident.status === "resolved") {
      return { ok: false, error: "Esta novedad ya está solucionada." };
    }
    if (incident.status === "waiting") {
      return { ok: false, error: "Está en manos de la transportadora. Espera su respuesta." };
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

    incident.retryDate = resolution === "date" ? data.retryDate?.trim() : undefined;
    incident.newAddress =
      resolution === "new_address" ? data.newAddress?.trim() : undefined;
    incident.newCity = resolution === "change_city" ? data.newCity?.trim() : undefined;

    return { ok: true, value: incident };
  }

}
