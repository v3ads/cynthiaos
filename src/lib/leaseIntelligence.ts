// ─── Derived Lease Intelligence ───────────────────────────────────────────────
// Computes derived datasets from existing lease + action state (frontend-only).
// No new endpoints — derives from existing API data + localStorage action state.

import { LeaseExpiration } from './api';
import { loadLeaseActions, getLeaseActionSets } from './leaseActions';
import { getUrgencyLevel } from './urgency';

// Threshold: leases expiring within this many days are considered "urgent for first contact"
const CONTACT_URGENCY_THRESHOLD = 60;

// Threshold: leases not touched in this many days are considered "stale"
const STALE_DAYS_THRESHOLD = 3;

export interface DerivedIntelligence {
  /** Leases where contacted = false AND days_until_expiration <= threshold */
  leasesNotContacted: LeaseExpiration[];
  /** Leases where flagged = true */
  flaggedLeases: LeaseExpiration[];
  /** Leases where last_action_at > 3 days ago (or never acted on and urgency is HIGH/MEDIUM) */
  staleLeases: LeaseExpiration[];
}

export type QuickFilter = 'ALL' | 'URGENT' | 'FLAGGED' | 'NOT_CONTACTED' | 'STALE';

/**
 * Compute derived intelligence datasets from lease data + localStorage action state.
 */
export function computeDerivedIntelligence(leases: LeaseExpiration[]): DerivedIntelligence {
  const store = loadLeaseActions();
  const { contactedIds, flaggedIds } = getLeaseActionSets(store);
  const now = Date.now();
  const staleCutoff = STALE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;

  const leasesNotContacted = leases.filter(lease => {
    const isContacted = contactedIds.has(lease.id);
    return !isContacted && lease.days_until_expiration <= CONTACT_URGENCY_THRESHOLD;
  });

  const flaggedLeases = leases.filter(lease => flaggedIds.has(lease.id));

  const staleLeases = leases.filter(lease => {
    // Contacted leases are excluded from stale — they've been acted on
    if (contactedIds.has(lease.id)) return false;
    const record = store[lease.id];
    const urgency = getUrgencyLevel(lease.days_until_expiration);
    // Only consider HIGH/MEDIUM urgency leases for staleness
    if (urgency === 'LOW') return false;
    if (!record || !record.last_action_at) {
      // Never acted on — considered stale if urgent
      return true;
    }
    const lastActionMs = new Date(record.last_action_at).getTime();
    return now - lastActionMs > staleCutoff;
  });

  return { leasesNotContacted, flaggedLeases, staleLeases };
}

/**
 * Apply a quick filter to a list of leases using derived intelligence.
 */
export function applyQuickFilter(
  leases: LeaseExpiration[],
  filter: QuickFilter,
  intelligence: DerivedIntelligence
): LeaseExpiration[] {
  switch (filter) {
    case 'ALL':
      return leases;
    case 'URGENT':
      return leases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH');
    case 'FLAGGED':
      return intelligence.flaggedLeases;
    case 'NOT_CONTACTED':
      return intelligence.leasesNotContacted;
    case 'STALE':
      return intelligence.staleLeases;
    default:
      return leases;
  }
}
