'use client';

// ─── Lease Actions Context ────────────────────────────────────────────────────
// Replaces localStorage for all lease action state (contacted, flagged, notes,
// last_action_at). Loads all records from the DB in a single bulk call on mount,
// then writes back to the DB on every update (with optimistic in-memory updates).

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getAllLeaseActionsFromApi, putLeaseActionsToApi, LeaseActionsApiPayload } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaseActionRecord {
  lease_id: string;
  contacted: boolean;
  flagged: boolean;
  notes: string;
  last_action_at: string | null;
}

export type LeaseActionsStore = Record<string, LeaseActionRecord>;

interface LeaseActionsContextValue {
  /** All action records keyed by lease_id. Empty object while loading. */
  store: LeaseActionsStore;
  /** True while the initial bulk fetch is in progress. */
  loading: boolean;
  /** Set of lease IDs that have been contacted. */
  contactedIds: Set<string>;
  /** Set of lease IDs that have been flagged. */
  flaggedIds: Set<string>;
  /**
   * Update one or more fields for a lease. Writes to DB immediately (optimistic).
   * Returns the updated record.
   */
  updateAction: (
    leaseId: string,
    patch: Partial<Pick<LeaseActionRecord, 'contacted' | 'flagged' | 'notes'>>
  ) => Promise<LeaseActionRecord>;
  /** Get the action record for a lease, returning defaults if not found. */
  getAction: (leaseId: string) => LeaseActionRecord;
  /** Reload all actions from the DB (e.g. after a page focus). */
  refresh: () => Promise<void>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultRecord(leaseId: string): LeaseActionRecord {
  return { lease_id: leaseId, contacted: false, flagged: false, notes: '', last_action_at: null };
}

function buildSets(store: LeaseActionsStore): { contactedIds: Set<string>; flaggedIds: Set<string> } {
  const contactedIds = new Set<string>();
  const flaggedIds = new Set<string>();
  Object.values(store).forEach(r => {
    if (r.contacted) contactedIds.add(r.lease_id);
    if (r.flagged) flaggedIds.add(r.lease_id);
  });
  return { contactedIds, flaggedIds };
}

function apiPayloadToRecord(leaseId: string, p: LeaseActionsApiPayload): LeaseActionRecord {
  return {
    lease_id: leaseId,
    contacted: p.contacted ?? false,
    flagged: p.flagged ?? false,
    notes: p.notes ?? '',
    last_action_at: p.last_action_at ?? null,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LeaseActionsContext = createContext<LeaseActionsContextValue | null>(null);

export function LeaseActionsProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<LeaseActionsStore>({});
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const loadAll = useCallback(async () => {
    try {
      const raw = await getAllLeaseActionsFromApi();
      const mapped: LeaseActionsStore = {};
      Object.entries(raw).forEach(([leaseId, payload]) => {
        mapped[leaseId] = apiPayloadToRecord(leaseId, payload);
      });
      setStore(mapped);
    } catch {
      // Network failure — leave store as-is (empty on first load)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadAll();
  }, [loadAll]);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const getAction = useCallback((leaseId: string): LeaseActionRecord => {
    return store[leaseId] ?? defaultRecord(leaseId);
  }, [store]);

  const updateAction = useCallback(async (
    leaseId: string,
    patch: Partial<Pick<LeaseActionRecord, 'contacted' | 'flagged' | 'notes'>>
  ): Promise<LeaseActionRecord> => {
    const existing = store[leaseId] ?? defaultRecord(leaseId);
    const optimistic: LeaseActionRecord = {
      ...existing,
      ...patch,
      lease_id: leaseId,
      last_action_at: new Date().toISOString(),
    };

    // Optimistic update — UI responds immediately
    setStore(prev => ({ ...prev, [leaseId]: optimistic }));

    // Persist to DB
    const apiPayload: LeaseActionsApiPayload = {
      contacted: optimistic.contacted,
      flagged: optimistic.flagged,
      notes: optimistic.notes,
      last_action_at: optimistic.last_action_at,
    };
    const result = await putLeaseActionsToApi(leaseId, apiPayload);

    if (result) {
      // Reconcile with server response
      const reconciled = apiPayloadToRecord(leaseId, result);
      setStore(prev => ({ ...prev, [leaseId]: reconciled }));
      return reconciled;
    }

    // DB write failed — keep optimistic state, log warning
    console.warn('[LeaseActionsContext] PUT failed for lease', leaseId, '— keeping optimistic state');
    return optimistic;
  }, [store]);

  const { contactedIds, flaggedIds } = buildSets(store);

  return (
    <LeaseActionsContext.Provider value={{ store, loading, contactedIds, flaggedIds, updateAction, getAction, refresh }}>
      {children}
    </LeaseActionsContext.Provider>
  );
}

export function useLeaseActions(): LeaseActionsContextValue {
  const ctx = useContext(LeaseActionsContext);
  if (!ctx) throw new Error('useLeaseActions must be used within a LeaseActionsProvider');
  return ctx;
}
