// ─── Lease Actions Persistence Layer ─────────────────────────────────────────
// Stores per-lease action state in localStorage (optimistic source).
// API sync is handled by callers via getLeaseActionsFromApi / putLeaseActionsToApi.

const STORAGE_KEY = 'cynthiaos_lease_actions';

export interface LeaseActionRecord {
  lease_id: string;
  contacted: boolean;
  flagged: boolean;
  notes: string;
  last_action_at: string | null;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadLeaseActions(): Record<string, LeaseActionRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLeaseActions(store: Record<string, LeaseActionRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function getLeaseAction(leaseId: string): LeaseActionRecord {
  const store = loadLeaseActions();
  return (
    store[leaseId] ?? {
      lease_id: leaseId,
      contacted: false,
      flagged: false,
      notes: '',
      last_action_at: null,
    }
  );
}

export function updateLeaseAction(
  leaseId: string,
  patch: Partial<Omit<LeaseActionRecord, 'lease_id' | 'last_action_at'>>
): LeaseActionRecord {
  const store = loadLeaseActions();
  const existing = store[leaseId] ?? {
    lease_id: leaseId,
    contacted: false,
    flagged: false,
    notes: '',
    last_action_at: null,
  };
  const updated: LeaseActionRecord = {
    ...existing,
    ...patch,
    lease_id: leaseId,
    last_action_at: new Date().toISOString(),
  };
  store[leaseId] = updated;
  saveLeaseActions(store);
  return updated;
}

/** Merge an API record into localStorage (API wins on defined fields). */
export function mergeApiRecord(leaseId: string, apiRecord: Partial<LeaseActionRecord>): LeaseActionRecord {
  const store = loadLeaseActions();
  const existing = store[leaseId] ?? {
    lease_id: leaseId,
    contacted: false,
    flagged: false,
    notes: '',
    last_action_at: null,
  };
  const merged: LeaseActionRecord = {
    ...existing,
    ...(apiRecord.contacted !== undefined ? { contacted: apiRecord.contacted } : {}),
    ...(apiRecord.flagged !== undefined ? { flagged: apiRecord.flagged } : {}),
    ...(apiRecord.notes !== undefined && apiRecord.notes !== '' ? { notes: apiRecord.notes } : {}),
    ...(apiRecord.last_action_at ? { last_action_at: apiRecord.last_action_at } : {}),
    lease_id: leaseId,
  };
  store[leaseId] = merged;
  saveLeaseActions(store);
  return merged;
}

/** Returns Sets of contacted and flagged lease IDs from the store. */
export function getLeaseActionSets(store: Record<string, LeaseActionRecord>): {
  contactedIds: Set<string>;
  flaggedIds: Set<string>;
} {
  const contactedIds = new Set<string>();
  const flaggedIds = new Set<string>();
  Object.values(store).forEach(r => {
    if (r.contacted) contactedIds.add(r.lease_id);
    if (r.flagged) flaggedIds.add(r.lease_id);
  });
  return { contactedIds, flaggedIds };
}

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