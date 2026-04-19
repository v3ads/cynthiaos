'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Search, X, ChevronDown, ChevronUp,
  Wrench, CheckCircle2, Clock, AlertCircle, Ban,
  Calendar, User, Building2, Mail,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkOrder {
  work_order_id: string;
  work_order_number: string | null;
  status: string;
  priority: string | null;
  unit_id: string | null;
  vendor: string | null;
  amount: number | null;
  issue: string | null;
  description: string | null;
  primary_tenant: string | null;
  created_at: string | null;
  completed_on: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  submitted_by_tenant: boolean | null;
}

interface MaintenanceResponse {
  success: boolean;
  total: number;
  summary: {
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    total_amount: number;
  };
  data: WorkOrder[];
}

type TabFilter = 'all' | 'open' | 'completed' | 'canceled';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPEN_STATUSES   = new Set(['Assigned', 'New', 'Scheduled']);
const COMP_STATUSES   = new Set(['Completed', 'Completed No Need To Bill']);
const CANCEL_STATUSES = new Set(['Canceled']);

// Internal operational note patterns — records that match these should be excluded.
// Criteria: null unit_id AND null primary_tenant AND description matches a known
// internal pattern (pool chemicals, staff training, etc.)
const INTERNAL_PATTERNS = [
  /chlorine/i,
  /acid tank/i,
  /pool fill/i,
  /human trafficking/i,
  /safestaff/i,
  /online.*course/i,
  /complete course/i,
  /training course/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInternalRecord(r: WorkOrder): boolean {
  if (r.unit_id || r.primary_tenant) return false; // has a resident — keep it
  const text = `${r.description ?? ''} ${r.issue ?? ''}`.toLowerCase();
  return INTERNAL_PATTERNS.some(p => p.test(text));
}

function matchesTab(r: WorkOrder, tab: TabFilter): boolean {
  if (tab === 'all') return true;
  if (tab === 'open')      return OPEN_STATUSES.has(r.status);
  if (tab === 'completed') return COMP_STATUSES.has(r.status);
  if (tab === 'canceled')  return CANCEL_STATUSES.has(r.status);
  return true;
}

function sortOrders(records: WorkOrder[]): WorkOrder[] {
  return [...records].sort((a, b) => {
    const aOpen = OPEN_STATUSES.has(a.status) ? 0 : 1;
    const bOpen = OPEN_STATUSES.has(b.status) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const aDate = a.created_at ?? '';
    const bDate = b.created_at ?? '';
    return bDate.localeCompare(aDate);
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtName(raw: string | null): string {
  if (!raw) return '—';
  // Convert "LAST, FIRST" to "First Last"
  if (/^[A-Z][A-Z\s,.'\\-]+$/.test(raw) && raw.includes(',')) {
    const [last, ...first] = raw.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  if (raw.includes(',')) {
    const [last, ...first] = raw.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean).join(' ');
  }
  return raw;
}

function isCurrentMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  let cls = '';
  let Icon = Clock;
  if (OPEN_STATUSES.has(status)) {
    cls = status === 'New'
      ? 'bg-warning/10 text-warning border-warning/25'
      : 'bg-accent/10 text-accent border-accent/25';
    Icon = Clock;
  } else if (COMP_STATUSES.has(status)) {
    cls = 'bg-success/10 text-success border-success/25';
    Icon = CheckCircle2;
  } else if (CANCEL_STATUSES.has(status)) {
    cls = 'bg-surface-elevated text-text-muted border-border/40';
    Icon = Ban;
  } else {
    cls = 'bg-surface-elevated text-text-secondary border-border/40';
    Icon = AlertCircle;
  }
  const label = status === 'Completed No Need To Bill' ? 'Completed' : status;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon size={10} className="flex-shrink-0" />
      {label}
    </span>
  );
}

// ─── Expanded Detail Panel ────────────────────────────────────────────────────

function DetailPanel({ order }: { order: WorkOrder }) {
  const rows = [
    { label: 'Work Order #', val: order.work_order_number ?? '—' },
    { label: 'Priority',     val: order.priority ?? '—' },
    { label: 'Vendor',       val: order.vendor ?? '—' },
    { label: 'Amount',       val: order.amount ? `$${order.amount.toFixed(2)}` : '—' },
    { label: 'Scheduled',    val: order.scheduled_start
        ? `${fmtDate(order.scheduled_start)}${order.scheduled_end && order.scheduled_end !== order.scheduled_start ? ` – ${fmtDate(order.scheduled_end)}` : ''}`
        : '—' },
    { label: 'Submitted by Tenant', val: order.submitted_by_tenant ? 'Yes' : 'No' },
  ];

  return (
    <div className="border-t border-border/40 bg-surface-elevated/40 px-5 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent/80 mb-2">Order Details</p>
          <div className="space-y-1.5">
            {rows.map(r => (
              <div key={r.label} className="flex justify-between py-0.5 border-b border-border/20 last:border-0">
                <span className="text-xs text-text-secondary">{r.label}</span>
                <span className="text-xs text-text-secondary font-medium">{r.val}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent/80 mb-2">Description</p>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
            {order.description || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MaintenanceContent() {
  const [allOrders, setAllOrders]   = useState<WorkOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tab, setTab]               = useState<TabFilter>('all');
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy?_path=/api/v1/maintenance&limit=500');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json: MaintenanceResponse = await res.json();
      // Filter internal records before storing
      const visible = (json.data ?? []).filter(r => !isInternalRecord(r));
      setAllOrders(sortOrders(visible));
      if (isRefresh) toast.success('Maintenance data refreshed.');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Summary metrics (from filtered dataset) ───────────────────────────────
  const openCount        = allOrders.filter(r => OPEN_STATUSES.has(r.status)).length;
  const assignedCount    = allOrders.filter(r => r.status === 'Assigned').length;
  const completedMonth   = allOrders.filter(r => COMP_STATUSES.has(r.status) && isCurrentMonth(r.completed_on)).length;

  // ── Client-side filtering ─────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = allOrders.filter(r => {
    if (!matchesTab(r, tab)) return false;
    if (!q) return true;
    return (
      (r.unit_id ?? '').toLowerCase().includes(q) ||
      fmtName(r.primary_tenant).toLowerCase().includes(q) ||
      (r.primary_tenant ?? '').toLowerCase().includes(q) ||
      (r.issue ?? '').toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.work_order_number ?? '').toLowerCase().includes(q)
    );
  });

  const TAB_LABELS: { id: TabFilter; label: string }[] = [
    { id: 'all',       label: `All (${allOrders.length})` },
    { id: 'open',      label: `Open (${openCount})` },
    { id: 'completed', label: `Completed` },
    { id: 'canceled',  label: `Canceled` },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-7">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Operations</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Maintenance</h1>
          <p className="text-text-secondary text-sm mt-1.5">
            Work orders from AppFolio — active and historical
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border/50 rounded-xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-surface-elevated rounded mb-3" />
              <div className="h-8 w-12 bg-surface-elevated rounded" />
            </div>
          ))
        ) : (
          [
            {
              label: 'Open Orders',
              value: openCount,
              icon: Wrench,
              cls: openCount > 0 ? 'text-warning' : 'text-text-primary',
              iconCls: 'bg-warning/15 text-warning',
            },
            {
              label: 'Assigned',
              value: assignedCount,
              icon: Clock,
              cls: 'text-text-primary',
              iconCls: 'bg-accent/15 text-accent',
            },
            {
              label: 'Completed This Month',
              value: completedMonth,
              icon: CheckCircle2,
              cls: 'text-text-primary',
              iconCls: 'bg-success/15 text-success',
            },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-surface border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconCls}`}>
                    <Icon size={14} />
                  </div>
                  <p className="text-xs text-text-secondary">{card.label}</p>
                </div>
                <p className={`text-3xl font-bold tabular-nums ${card.cls}`}>{card.value}</p>
              </div>
            );
          })
        )}
      </div>

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1">
          {TAB_LABELS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t.id
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Unit, tenant, issue, WO#…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm bg-surface border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
              <X size={13} />
            </button>
          )}
        </div>

        <span className="ml-auto text-xs text-text-muted tabular-nums">
          {filtered.length} of {allOrders.length} orders
        </span>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[3rem_6rem_7rem_1fr_7rem_6rem_6rem_6rem] border-b border-border/40 px-4">
          {['', 'Unit', 'Tenant', 'Issue', 'Status', 'Created', 'Completed', ''].map((h, i) => (
            <div key={i} className="py-2.5 text-xs font-semibold uppercase tracking-wider text-accent/80">
              {h}
            </div>
          ))}
        </div>

        {/* States */}
        {loading ? (
          <div className="divide-y divide-border/30">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[3rem_6rem_7rem_1fr_7rem_6rem_6rem_6rem] px-4 py-3.5 animate-pulse">
                {[6,10,16,24,14,14,14,6].map((w, j) => (
                  <div key={j} className="h-4 bg-surface-elevated rounded" style={{ width: `${w * 4}px` }} />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle size={28} className="text-danger mb-3" />
            <p className="text-sm font-medium text-danger mb-1">Failed to load</p>
            <p className="text-xs text-text-muted mb-3">{error}</p>
            <button onClick={() => load()} className="text-xs text-accent hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Wrench size={28} className="text-text-muted mb-3" />
            <p className="text-sm font-medium text-text-primary">No work orders found</p>
            <p className="text-xs text-text-secondary mt-1">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(order => {
              const isExpanded = expandedId === order.work_order_id;
              const isOpen = OPEN_STATUSES.has(order.status);
              const tenantName = fmtName(order.primary_tenant);

              return (
                <React.Fragment key={order.work_order_id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : order.work_order_id)}
                    className={`cursor-pointer transition-colors ${
                      isExpanded ? 'bg-surface-elevated/60' : 'hover:bg-surface-elevated/30'
                    } ${isOpen ? 'border-l-2 border-l-accent' : ''}`}
                  >
                    {/* Mobile */}
                    <div className="md:hidden px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            {order.issue || 'Work Order'}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {order.unit_id ? `Unit ${order.unit_id}` : 'Common Area'}
                            {tenantName !== '—' ? ` · ${tenantName}` : ''}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      {order.description && (
                        <p className="text-xs text-text-secondary line-clamp-2">{order.description}</p>
                      )}
                      <p className="text-xs text-text-secondary mt-1.5">{fmtDate(order.created_at)}</p>
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-[3rem_6rem_7rem_1fr_7rem_6rem_6rem_6rem] px-4 py-3 items-center">
                      {/* Expand icon */}
                      <div className="flex items-center">
                        {isExpanded
                          ? <ChevronUp size={14} className="text-text-muted" />
                          : <ChevronDown size={14} className="text-text-muted" />
                        }
                      </div>

                      {/* Unit */}
                      <div>
                        {order.unit_id ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 size={11} className="text-text-muted flex-shrink-0" />
                            <span className="text-xs font-semibold text-text-primary">{order.unit_id}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary italic">Common</span>
                        )}
                      </div>

                      {/* Tenant */}
                      <div className="min-w-0 pr-2">
                        {tenantName !== '—' ? (
                          <p className="text-xs text-text-secondary truncate">{tenantName}</p>
                        ) : (
                          <span className="text-xs text-text-muted/50">—</span>
                        )}
                      </div>

                      {/* Issue + description truncated */}
                      <div className="min-w-0 pr-3">
                        <p className="text-xs font-medium text-text-primary truncate">
                          {order.issue || '—'}
                        </p>
                        {order.description && (
                          <p className="text-xs text-text-secondary truncate">{order.description}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div><StatusBadge status={order.status} /></div>

                      {/* Created */}
                      <div>
                        <p className="text-xs text-text-secondary tabular-nums">{fmtDate(order.created_at)}</p>
                      </div>

                      {/* Completed */}
                      <div>
                        <p className="text-xs text-text-secondary tabular-nums">{fmtDate(order.completed_on)}</p>
                      </div>

                      {/* Contact */}
                      <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
                        {/* Maintenance records don't include email — skip gracefully */}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && <DetailPanel order={order} />}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
