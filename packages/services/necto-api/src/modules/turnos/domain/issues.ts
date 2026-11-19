/** Collects the problems of one request, field by field, so they can all be reported together. */
export class Issues {
  readonly fields: Record<string, string[]> = {};

  add(path: string, message: string): void {
    (this.fields[path] ??= []).push(message);
  }

  get any(): boolean {
    return Object.keys(this.fields).length > 0;
  }
}

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
