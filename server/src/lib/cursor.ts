// Opaque cursors: base64url-encoded JSON. Clients pass back what they get.

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Keyset cursor for lists ordered by (created_at DESC, id DESC). */
export interface TimeCursor {
  t: string; // ISO timestamp
  id: number;
}

export function parseLimit(raw: unknown, fallback = 10, max = 50): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * Offset cursor for short, rarely-changing lists (profile grids, follower
 * lists). Simpler than keyset; can skip or repeat an item if the list changes
 * between pages, which is acceptable there.
 */
export function offsetFrom(raw: unknown): number {
  const c = decodeCursor<{ o: number }>(raw);
  return c && Number.isSafeInteger(c.o) && c.o > 0 ? c.o : 0;
}

/** Given rows fetched with LIMIT limit+1, return the page and the next cursor. */
export function offsetPage<T>(rows: T[], offset: number, limit: number): { items: T[]; nextCursor: string | null } {
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? encodeCursor({ o: offset + limit }) : null,
  };
}
