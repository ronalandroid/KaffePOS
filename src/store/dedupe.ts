// src/store/dedupe.ts — anti-duplicate tracking for records we INSERT ourselves,
// so realtime/echoed events don't re-add an item we already have locally.
const INSERT_TRACK_TTL_MS = 20_000;

export const recentlyInserted = new Set<string>();

export function markInserted(id: string) {
  recentlyInserted.add(id);
  setTimeout(() => recentlyInserted.delete(id), INSERT_TRACK_TTL_MS);
}
