'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getLeasesExpiringSoon, LeaseExpiration, PaginatedResponse } from '@/lib/api';
import { getUrgencyLevel, UrgencyLevel } from '@/lib/urgency';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import LeaseTable from '@/components/ui/LeaseTable';
import Pagination from '@/components/ui/Pagination';
import LeaseDetailDrawer from '@/components/ui/LeaseDetailDrawer';
import { AlertCircle, Search, X, RefreshCw, Phone } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadLeaseActions,
  updateLeaseAction,
  getLeaseActionSets,
  LeaseActionRecord,
} from '@/lib/leaseActions';
import { computeDerivedIntelligence, applyQuickFilter, QuickFilter } from '@/lib/leaseIntelligence';

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'URGENT', label: 'Urgent' },
  { key: 'FLAGGED', label: 'Flagged' },
  { key: 'NOT_CONTACTED', label: 'Not Contacted' },
  { key: 'STALE', label: 'Stale' },
];

export default function LeasesExpiringSoonContent() {
  const [data, setData] = useState<PaginatedResponse<LeaseExpiration> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | UrgencyLevel>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');

  // Drawer state
  const [selectedLease, setSelectedLease] = useState<LeaseExpiration | null>(null);

  // Persistent action state — loaded from localStorage on mount
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  // Load persisted action sets on mount
  useEffect(() => {
    const store = loadLeaseActions();
    const { contactedIds: c, flaggedIds: f } = getLeaseActionSets(store);
    setContactedIds(c);
    setFlaggedIds(f);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLeasesExpiringSoon(1, 500);
      // Deduplicate: one record per unit, keeping the soonest expiration
      const seenUnits = new Map<string, typeof result.data[0]>();
      (result.data || []).forEach(r => {
        const existing = seenUnits.get(r.unit);
        if (!existing || (r.days_until_expiration ?? 9999) < (existing.days_until_expiration ?? 9999)) {
          seenUnits.set(r.unit, r);
        }
      });
      result.data = Array.from(seenUnits.values());
      result.total = result.data.length;
      setData(result);

      // Load action sets from localStorage (API sync happens lazily in the drawer)
      const store = loadLeaseActions();
      const { contactedIds: c, flaggedIds: f } = getLeaseActionSets(store);
      setContactedIds(c);
      setFlaggedIds(f);
    } catch {
      toast.error('Failed to load expiring leases. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute derived intelligence from current lease data + action state
  const allLeases = data?.data || [];
  const intelligence = computeDerivedIntelligence(allLeases);

  // Apply quick filter first, then urgency + search
  const quickFiltered = applyQuickFilter(allLeases, quickFilter, intelligence);

  const filtered = quickFiltered.filter(lease => {
    const matchesSearch =
      !search ||
      lease.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
      lease.unit.toLowerCase().includes(search.toLowerCase()) ||
      lease.property.toLowerCase().includes(search.toLowerCase());
    const matchesUrgency = urgencyFilter === 'ALL' || getUrgencyLevel(lease.days_until_expiration) === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const highCount = allLeases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH').length;
  const mediumCount = allLeases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'MEDIUM').length;

  /** Refresh the in-memory Sets from localStorage after any action */
  const refreshSets = () => {
    const store = loadLeaseActions();
    const { contactedIds: c, flaggedIds: f } = getLeaseActionSets(store);
    setContactedIds(c);
    setFlaggedIds(f);
  };

  const handleMarkContacted = (lease: LeaseExpiration) => {
    const current = contactedIds.has(lease.id);
    updateLeaseAction(lease.id, { contacted: !current });
    refreshSets();
  };

  const handleFlagFollowUp = (lease: LeaseExpiration) => {
    const current = flaggedIds.has(lease.id);
    updateLeaseAction(lease.id, { flagged: !current });
    refreshSets();
  };

  /** Called by drawer after any action so table indicators stay in sync */
  const handleDrawerActionUpdate = (_leaseId: string, _record: LeaseActionRecord) => {
    refreshSets();
  };

  const handleQuickFilter = (f: QuickFilter) => {
    setQuickFilter(f);
    setPage(1);
  };

  // Quick filter counts
  const quickFilterCounts: Record<QuickFilter, number> = {
    ALL: allLeases.length,
    URGENT: allLeases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH').length,
    FLAGGED: intelligence.flaggedLeases.length,
    NOT_CONTACTED: intelligence.leasesNotContacted.length,
    STALE: intelligence.staleLeases.length,
  };

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/12 border border-danger/25 flex items-center justify-center">
            <AlertCircle size={18} className="text-danger" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Leases Expiring Soon</h1>
            <p className="text-text-secondary text-sm mt-0.5">Leases expiring within the next 60 days</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {!loading && highCount > 0 && (
        <div className="flex items-center gap-3 bg-danger/8 border border-danger/25 rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={16} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger font-medium">
            {highCount} lease{highCount > 1 ? 's' : ''} expiring within 30 days — immediate contact required.
          </p>
          <a
            href="tel:"
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-danger hover:text-danger/80 transition-colors flex-shrink-0"
          >
            <Phone size={13} />
            Begin outreach
          </a>
        </div>
      )}

      {/* Stats Row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-danger tabular-nums">{highCount}</p>
            <p className="text-xs text-text-secondary mt-1 font-medium">High Urgency (0–30 days)</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-warning tabular-nums">{mediumCount}</p>
            <p className="text-xs text-text-secondary mt-1 font-medium">Medium Urgency (31–60 days)</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-2xl font-bold text-text-primary tabular-nums">{data?.total || 0}</p>
            <p className="text-xs text-text-secondary mt-1 font-medium">Total Expiring Soon</p>
          </div>
        </div>
      )}

      {/* Quick Filter Chips */}
      {!loading && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {QUICK_FILTERS.map(({ key, label }) => {
            const count = quickFilterCounts[key];
            const isActive = quickFilter === key;
            const chipStyle =
              key === 'URGENT' ? (isActive ? 'bg-danger/20 text-danger border-danger/40' : 'text-text-muted border-border/50 hover:border-danger/30 hover:text-danger/80')
              : key === 'FLAGGED' ? (isActive ? 'bg-warning/20 text-warning border-warning/40' : 'text-text-muted border-border/50 hover:border-warning/30 hover:text-warning/80')
              : key === 'NOT_CONTACTED' ? (isActive ? 'bg-danger/15 text-danger border-danger/35' : 'text-text-muted border-border/50 hover:border-danger/25 hover:text-danger/70')
              : key === 'STALE' ? (isActive ? 'bg-warning/15 text-warning border-warning/35' : 'text-text-muted border-border/50 hover:border-warning/25 hover:text-warning/70')
              : (isActive ? 'bg-surface-elevated text-text-primary border-border' : 'text-text-muted border-border/50 hover:border-border hover:text-text-secondary');
            return (
              <button
                key={key}
                onClick={() => handleQuickFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${chipStyle}`}
              >
                {label}
                <span className="ml-1.5 tabular-nums opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-border/50">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search tenant, unit, or property..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-surface-elevated border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-colors"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(['ALL', 'HIGH', 'MEDIUM'] as const).map(level => (
              <button
                key={`urgency-filter-${level}`}
                onClick={() => { setUrgencyFilter(level); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  urgencyFilter === level
                    ? level === 'HIGH' ? 'bg-danger/20 text-danger border-danger/40'
                      : level === 'MEDIUM'? 'bg-warning/20 text-warning border-warning/40' : 'bg-surface-elevated text-text-primary border-border' :'bg-transparent text-text-muted border-border/50 hover:border-border hover:text-text-secondary'
                }`}
              >
                {level === 'ALL' ? 'All' : level.charAt(0) + level.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : (
          <LeaseTable
            leases={paginated}
            showActions
            contactedIds={contactedIds}
            flaggedIds={flaggedIds}
            onViewDetails={setSelectedLease}
            onMarkContacted={handleMarkContacted}
            onFlagFollowUp={handleFlagFollowUp}
          />
        )}

        {!loading && filtered.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            perPage={perPage}
            onPageChange={p => setPage(p)}
            onPerPageChange={n => { setPerPage(n); setPage(1); }}
          />
        )}
      </div>

      {/* Lease Detail Drawer */}
      <LeaseDetailDrawer
        lease={selectedLease}
        onClose={() => setSelectedLease(null)}
        onActionUpdate={handleDrawerActionUpdate}
      />
    </div>
  );
}