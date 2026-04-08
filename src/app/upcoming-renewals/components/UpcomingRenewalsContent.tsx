'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getUpcomingRenewals, UpcomingRenewal, PaginatedResponse } from '@/lib/api';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import { RefreshCw, Search, X, TrendingUp, Mail } from 'lucide-react';
import { toast } from 'sonner';

type RenewalStatusFilter = 'ALL' | 'pending' | 'in_progress' | 'signed' | 'declined';

const RENEWAL_STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'neutral' as const },
  in_progress: { label: 'In Progress', variant: 'info' as const },
  signed: { label: 'Signed', variant: 'success' as const },
  declined: { label: 'Declined', variant: 'danger' as const },
};

export default function UpcomingRenewalsContent() {
  const [data, setData] = useState<PaginatedResponse<UpcomingRenewal> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RenewalStatusFilter>('ALL');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Backend integration: GET /api/v1/leases/upcoming-renewals
      const result = await getUpcomingRenewals(1, 50);
      setData(result);
    } catch {
      toast.error('Failed to load upcoming renewals. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = (data?.data || []).filter(renewal => {
    const matchesSearch =
      !search ||
      renewal.tenant_name.toLowerCase().includes(search.toLowerCase()) ||
      renewal.unit.toLowerCase().includes(search.toLowerCase()) ||
      renewal.property.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || renewal.renewal_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatRent = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const statusCounts = {
    ALL: data?.data.length || 0,
    pending: (data?.data || []).filter(r => r.renewal_status === 'pending').length,
    in_progress: (data?.data || []).filter(r => r.renewal_status === 'in_progress').length,
    signed: (data?.data || []).filter(r => r.renewal_status === 'signed').length,
    declined: (data?.data || []).filter(r => r.renewal_status === 'declined').length,
  };

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/12 border border-accent/25 flex items-center justify-center">
            <RefreshCw size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Upcoming Renewals</h1>
            <p className="text-text-muted text-sm mt-0.5">Renewal pipeline for the next 90 days</p>
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

      {/* Status Summary Row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(['pending', 'in_progress', 'signed', 'declined'] as const).map(status => {
            const config = RENEWAL_STATUS_CONFIG[status];
            const count = statusCounts[status];
            const colorMap = { pending: 'text-text-secondary', in_progress: 'text-info', signed: 'text-accent', declined: 'text-danger' };
            return (
              <div key={`summary-${status}`} className="bg-surface border border-border rounded-xl p-4">
                <p className={`text-2xl font-bold tabular-nums ${colorMap[status]}`}>{count}</p>
                <p className="text-xs text-text-muted mt-1 font-medium">{config.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Declined Warning */}
      {!loading && statusCounts.declined > 0 && (
        <div className="flex items-center gap-3 bg-danger/8 border border-danger/25 rounded-xl px-4 py-3 mb-6">
          <TrendingUp size={16} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger font-medium">
            {statusCounts.declined} tenant{statusCounts.declined > 1 ? 's' : ''} declined renewal — begin re-leasing to prevent vacancy.
          </p>
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
          <div className="flex items-center gap-2 flex-wrap">
            {(['ALL', 'pending', 'in_progress', 'signed', 'declined'] as RenewalStatusFilter[]).map(status => (
              <button
                key={`status-filter-${status}`}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  statusFilter === status
                    ? 'bg-surface-elevated text-text-primary border-border' :'bg-transparent text-text-muted border-border/50 hover:border-border hover:text-text-secondary'
                }`}
              >
                {status === 'ALL' ? 'All' : status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                <span className="ml-1 opacity-60 tabular-nums">({statusCounts[status]})</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw size={28} className="text-text-muted mb-4" />
            <p className="text-text-secondary font-medium">No renewals found</p>
            <p className="text-text-muted text-sm mt-1">Try adjusting your filters to see results.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {['Tenant', 'Unit', 'Property', 'Renewal Date', 'Days Left', 'Current Rent', 'Proposed Rent', 'Status', 'Actions'].map(col => (
                    <th key={`col-${col}`} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginated.map(renewal => {
                  const config = RENEWAL_STATUS_CONFIG[renewal.renewal_status];
                  const rentDiff = renewal.proposed_rent - renewal.current_rent;
                  const rentDiffPct = ((rentDiff / renewal.current_rent) * 100).toFixed(1);
                  const urgencyColor = renewal.days_until_renewal <= 30 ? 'text-danger' : renewal.days_until_renewal <= 60 ? 'text-warning' : 'text-accent';

                  return (
                    <tr key={renewal.id} className={`hover:bg-surface-elevated/50 transition-colors group ${renewal.renewal_status === 'declined' ? 'bg-danger/3' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0 text-xs font-semibold text-text-secondary">
                            {renewal.tenant_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">{renewal.tenant_name}</p>
                            <p className="text-xs text-text-muted">{renewal.contact_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary text-xs">{renewal.unit}</td>
                      <td className="px-4 py-3 text-text-secondary">{renewal.property}</td>
                      <td className="px-4 py-3 text-text-secondary tabular-nums whitespace-nowrap">{formatDate(renewal.renewal_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`tabular-nums font-semibold ${urgencyColor}`}>{renewal.days_until_renewal}d</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-text-secondary">{formatRent(renewal.current_rent)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="tabular-nums text-text-primary font-medium">{formatRent(renewal.proposed_rent)}</span>
                          {rentDiff !== 0 && (
                            <span className={`text-xs tabular-nums ${rentDiff > 0 ? 'text-accent' : 'text-danger'}`}>
                              {rentDiff > 0 ? '+' : ''}{rentDiffPct}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={config.label} variant={config.variant} dot />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={`mailto:${encodeURIComponent(renewal.contact_email ?? '')}?from=${encodeURIComponent('leasing@cynthiagardens.com')}`}
                            title={`Email ${renewal.tenant_name}`}
                            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            <Mail size={14} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}