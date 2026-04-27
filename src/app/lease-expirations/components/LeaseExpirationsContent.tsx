'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getLeaseExpirations, LeaseExpiration, PaginatedResponse } from '@/lib/api';
import { getUrgencyLevel, UrgencyLevel } from '@/lib/urgency';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import LeaseTable from '@/components/ui/LeaseTable';
import Pagination from '@/components/ui/Pagination';
import LeaseDetailDrawer from '@/components/ui/LeaseDetailDrawer';
import { FileText, Search, Filter, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useLeaseActions } from '@/contexts/LeaseActionsContext';
import { computeDerivedIntelligence, applyQuickFilter, QuickFilter } from '@/lib/leaseIntelligence';

type UrgencyFilter = 'ALL' | UrgencyLevel;

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'URGENT', label: 'Urgent' },
  { key: 'FLAGGED', label: 'Flagged' },
  { key: 'NOT_CONTACTED', label: 'Not Contacted' },
  { key: 'STALE', label: 'Stale' },
];

export default function LeaseExpirationsContent() {
  const { contactedIds, flaggedIds, updateAction, store: actionStore } = useLeaseActions();

  const [data, setData] = useState<PaginatedResponse<LeaseExpiration> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('ALL');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');

  // Drawer state
  const [selectedLease, setSelectedLease] = useState<LeaseExpiration | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLeaseExpirations(1, 800);
      // Keep only future leases (days_until_expiration > 0), then deduplicate
      // by unit_id keeping the soonest expiration per unit.
      const futureOnly = (result.data || []).filter(r => (r.days_until_expiration ?? 0) > 0);
      const seenUnits = new Map<string, typeof result.data[0]>();
      futureOnly.forEach(r => {
        const existing = seenUnits.get(r.unit);
        if (!existing || (r.days_until_expiration ?? 9999) < (existing.days_until_expiration ?? 9999)) {
          seenUnits.set(r.unit, r);
        }
      });
      result.data = Array.from(seenUnits.values());
      result.total = result.data.length;
      // Sort: ascending by days_until_expiration (soonest first)
      result.data.sort((a, b) => (a.days_until_expiration ?? 9999) - (b.days_until_expiration ?? 9999));
      // Group family units together — insert them as a block after sorting
      const familyLeases = result.data.filter(r => !!r.unit_group);
      const otherLeases  = result.data.filter(r => !r.unit_group);
      result.data = [...familyLeases, ...otherLeases];
      setData(result);
    } catch {
      toast.error('Failed to load lease expirations. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute derived intelligence from current lease data + action state
  const allLeases = data?.data || [];
  const intelligence = computeDerivedIntelligence(allLeases, actionStore);

  // Exclude contacted leases from the default view — they've been handled
  const activeLeases = allLeases.filter(l => !contactedIds.has(l.id));

  // Apply quick filter first, then urgency + search
  // Always use activeLeases as base — contacted leases are excluded from all views
  const quickFiltered = applyQuickFilter(activeLeases, quickFilter, intelligence);

  const filtered = quickFiltered.filter(lease => {
    const matchesSearch =
      !search ||
      lease.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
      lease.unit.toLowerCase().includes(search.toLowerCase()) ||
      lease.property.toLowerCase().includes(search.toLowerCase());
    const matchesUrgency =
      urgencyFilter === 'ALL' || getUrgencyLevel(lease.days_until_expiration) === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const handleUrgencyFilter = (level: UrgencyFilter) => {
    setUrgencyFilter(level);
    setPage(1);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleQuickFilter = (f: QuickFilter) => {
    setQuickFilter(f);
    setPage(1);
  };

  const handleMarkContacted = (lease: LeaseExpiration) => {
    const current = contactedIds.has(lease.id);
    updateAction(lease.id, { contacted: !current });
  };

  const handleFlagFollowUp = (lease: LeaseExpiration) => {
    const current = flaggedIds.has(lease.id);
    updateAction(lease.id, { flagged: !current });
  };

  const counts = {
    ALL: activeLeases.length,
    HIGH: activeLeases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH').length,
    MEDIUM: activeLeases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'MEDIUM').length,
    LOW: allLeases.filter(l => getUrgencyLevel(l.days_until_expiration) === 'LOW').length,
  };

  // Quick filter counts
  const quickFilterCounts: Record<QuickFilter, number> = {
    ALL: activeLeases.length,
    URGENT: counts.HIGH,
    FLAGGED: intelligence.flaggedLeases.length,
    NOT_CONTACTED: intelligence.leasesNotContacted.length,
    STALE: intelligence.staleLeases.length,
  };

  return (
    <div className="min-h-screen p-4 pt-16 lg:pt-6 p-6 lg:p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
            <FileText size={18} className="text-text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Lease Expirations</h1>
            <p className="text-text-secondary text-sm mt-0.5">All leases with upcoming expiration dates</p>
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

      {/* Filters + Table */}
      <div className="bg-surface border border-border rounded-xl mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-border/50">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search tenant, unit, or property..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-colors"
            />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Urgency Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-text-muted flex-shrink-0" />
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as UrgencyFilter[]).map(level => (
              <button
                key={`filter-${level}`}
                onClick={() => handleUrgencyFilter(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  urgencyFilter === level
                    ? level === 'HIGH' ? 'bg-danger/20 text-danger border-danger/40'
                      : level === 'MEDIUM' ? 'bg-warning/20 text-warning border-warning/40'
                      : level === 'LOW'? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-elevated text-text-primary border-border' :'bg-transparent text-text-muted border-border/50 hover:border-border hover:text-text-secondary'
                }`}
              >
                {level === 'ALL' ? 'All' : level.charAt(0) + level.slice(1).toLowerCase()}
                <span className="ml-1.5 tabular-nums opacity-70">({counts[level as keyof typeof counts] ?? 0})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
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

        {/* Pagination */}
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
      />
    </div>
  );
}
