import { makeAutoObservable } from "mobx";

import {
  createSeedPickups,
  createSeedRecurringPickups,
  sortDays,
  nextCode,
  validateSchedule,
  validatePickup,
  type RecurringPickup,
  type RecurringPickupInput,
  type PickupInput,
  type Pickup,
} from "../domain/pickupDomain";

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

interface PersistedPickupState {
  pickups: Pickup[];
  schedules: RecurringPickup[];
}

function readStoredPickups(key: string): PersistedPickupState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPickupState>;
    if (!Array.isArray(parsed.pickups) || !Array.isArray(parsed.schedules)) {
      return null;
    }
    return {
      pickups: parsed.pickups,
      schedules: parsed.schedules,
    };
  } catch {
    return null;
  }
}

function writeStoredPickups(key: string, state: PersistedPickupState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore storage quota or restricted-mode errors.
  }
}

export class PickupStore {
  pickups: Pickup[] = [];

  schedules: RecurringPickup[] = [];

  private readonly businessId?: string;

  constructor(businessId?: string) {
    this.businessId = businessId;
    makeAutoObservable<PickupStore, "businessId">(this, {
      businessId: false,
    });
    this.reload();
  }

  private get storageKey(): string | null {
    return this.businessId ? `necto.pedidos.pickups.${this.businessId}` : null;
  }

  private persist(): void {
    const key = this.storageKey;
    if (!key) return;
    writeStoredPickups(key, {
      pickups: this.pickups,
      schedules: this.schedules,
    });
  }

  reload(): void {
    const key = this.storageKey;
    if (key) {
      const stored = readStoredPickups(key);
      if (stored) {
        this.pickups = stored.pickups;
        this.schedules = stored.schedules;
        return;
      }
      this.pickups = createSeedPickups();
      this.schedules = createSeedRecurringPickups();
      this.persist();
      return;
    }

    this.pickups = createSeedPickups();
    this.schedules = createSeedRecurringPickups();
  }

  resetDemo(): void {
    this.pickups = createSeedPickups();
    this.schedules = createSeedRecurringPickups();
    this.persist();
  }

  create(data: PickupInput): Result<Pickup> {
    const errors = validatePickup(data);
    if (errors.length > 0) return { ok: false, error: errors.join(" ") };

    const pickup: Pickup = {
      id: `rec-${Date.now()}-${this.pickups.length + 1}`,
      code: nextCode(this.pickups),
      kind: data.kind,
      carrier: data.carrier.trim(),
      warehouse: data.warehouse.trim(),
      date: data.date,
      timeSlot: data.timeSlot.trim(),
      packages: Number(data.packages),
      dispatcher: data.dispatcher.trim(),
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    this.pickups.unshift(pickup);
    this.persist();
    return { ok: true, value: pickup };
  }

  get total(): number {
    return this.pickups.length;
  }

  saveSchedule(data: RecurringPickupInput, id?: string): Result<RecurringPickup> {
    const errors = validateSchedule(data);
    if (errors.length > 0) return { ok: false, error: errors.join(" ") };

    const fields = {
      carrier: data.carrier.trim(),
      days: sortDays(data.days),
      warehouse: data.warehouse.trim(),
      address: data.address.trim(),
      dispatcherFirstName: data.dispatcherFirstName.trim(),
      dispatcherLastName: data.dispatcherLastName.trim(),
      slot: data.slot,
      packages: Number(data.packages),
      notes: data.notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    const existing = id ? this.schedules.find((c) => c.id === id) : undefined;
    if (existing) {
      Object.assign(existing, fields);
      this.persist();
      return { ok: true, value: existing };
    }

    const newSchedule: RecurringPickup = {
      id: `cfg-${Date.now()}`,
      enabled: true,
      ...fields,
    };
    this.schedules.unshift(newSchedule);
    this.persist();
    return { ok: true, value: newSchedule };
  }

  toggleActive(id: string): void {
    const settings = this.schedules.find((c) => c.id === id);
    if (settings) {
      settings.enabled = !settings.enabled;
      this.persist();
    }
  }

  get activeSchedules(): number {
    return this.schedules.filter((c) => c.enabled).length;
  }
}
