import { makeAutoObservable } from "mobx";

import {
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

export class PickupStore {
  pickups: Pickup[] = [];

  schedules: RecurringPickup[] = [];

  constructor() {
    makeAutoObservable(this);
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
      return { ok: true, value: existing };
    }

    const newSchedule: RecurringPickup = { id: `cfg-${Date.now()}`, enabled: true, ...fields };
    this.schedules.unshift(newSchedule);
    return { ok: true, value: newSchedule };
  }

  toggleActive(id: string): void {
    const settings = this.schedules.find((c) => c.id === id);
    if (settings) settings.enabled = !settings.enabled;
  }

  get activeSchedules(): number {
    return this.schedules.filter((c) => c.enabled).length;
  }
}
