import { createHash } from 'node:crypto';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

/** A hash of a request that does not depend on the order of its fields. Used to tell a retry from a different request. */
export function fingerprintOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortKeys(value))).digest('hex');
}
