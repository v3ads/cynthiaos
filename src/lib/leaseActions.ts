// ─── Lease Action Utilities ───────────────────────────────────────────────────
// Pure utility functions for lease action state.
// All persistence is handled by LeaseActionsContext (DB-backed via API).
// No localStorage reads or writes.

/** Human-readable relative timestamp. */
export function formatActionTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return null;
  }
}
