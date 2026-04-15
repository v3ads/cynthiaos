'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  RefreshCw, Search, ChevronDown, ChevronUp,
  Building2, TrendingDown, ShieldAlert, RotateCcw,
  X, SlidersHorizontal, AlertOctagon,
} from 'lucide-react';
import { FAMILY_UNIT_LABEL as FAMILY_UNITS, FAMILY_UNIT_IDS } from '@/lib/familyUnits';

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitStatus       = 'occupied' | 'vacant' | 'notice';
type Classification   = 'High Risk Unit' | 'Vacancy Risk' | 'Turnover Heavy' | 'Stable Performer' | 'Neutral';
type SortField        = 'risk_score' | 'stability_score' | 'profitability_score' | 'financial_exposure';
type SortDir          = 'asc' | 'desc';

interface UnitRecord {
  unit_id: string;
  unit_status: UnitStatus;
  tenant_name: string;
  financial_exposure: number;
  delinquency_balance: number;
  ar_balance: number;
  max_days_overdue: number;
  turnover_count: number;
  stability_score: number;
  profitability_score: number;
  risk_score: number;
  classification: Classification;
  lease_end_date: string | null;
  days_until_expiration: number | null;
}

interface Summary {
  avg_risk_score: number;
  avg_stability_score: number;
  total_financial_exposure: number;
  classification_breakdown: Partial<Record<Classification, number>>;
  status_breakdown: Partial<Record<UnitStatus, number>>;
}

interface ApiResponse {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  summary: Summary;
  data: UnitRecord[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

// All API calls must go through the Next.js proxy to avoid CORS in production
const PAGE_SIZE = 50;

const CLASSIFICATION_CONFIG: Record<Classification, { label: string; dot: string; badge: string; icon: React.ElementType }> = {
  'High Risk Unit':    { label: 'High Risk',       dot: 'bg-danger',   badge: 'bg-danger/10 text-danger border-danger/25',     icon: AlertOctagon  },
  'Vacancy Risk':      { label: 'Vacancy Risk',     dot: 'bg-orange-400', badge: 'bg-orange-400/10 text-orange-400 border-orange-400/25', icon: Building2  },
  'Turnover Heavy':    { label: 'Turnover Heavy',   dot: 'bg-purple-400', badge: 'bg-purple-400/10 text-purple-400 border-purple-400/25', icon: RotateCcw  },
  'Stable Performer':  { label: 'Stable',           dot: 'bg-success',  badge: 'bg-success/10 text-success border-success/25',  icon: TrendingDown },
  'Neutral':           { label: 'Neutral',          dot: 'bg-text-muted', badge: 'bg-surface-elevated text-text-secondary border-border/40', icon: Building2 },
};

const STATUS_CONFIG: Record<UnitStatus, { label: string; cls: string }> = {
  occupied: { label: 'Occupied', cls: 'bg-success/10 text-success border-success/20'   },
  vacant:   { label: 'Vacant',   cls: 'bg-warning/10 text-warning border-warning/20'   },
  notice:   { label: 'Notice',   cls: 'bg-orange-400/10 text-orange-400 border-orange-400/20' },
};

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'risk_score',         label: 'Risk Score'          },
  { value: 'stability_score',    label: 'Stability Score'     },
  { value: 'profitability_score',label: 'Profitability Score' },
  { value: 'financial_exposure', label: 'Financial Exposure'  },
];

// Family unit labels come from @/lib/familyUnits (FAMILY_UNIT_LABEL)

const CLASSIFICATIONS: Classification[] = [
  'High Risk Unit', 'Vacancy Risk', 'Turnover Heavy', 'Stable Performer', 'Neutral',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  n === 0 ? '—' :
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function formatName(name: string): string {
  if (!name || name === 'Unknown') return '—';
  if (/^[A-Z][A-Z\s,.'\\-]+$/.test(name) && name.includes(',')) {
    const [last, ...first] = name.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  if (/^[a-z_]+$/.test(name)) {
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  // Handle "Last, First" mixed case
  if (name.includes(',')) {
    const [last, ...first] = name.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean).join(' ');
  }
  return name;
}

function riskColor(score: number): string {
  if (score <= 20) return 'text-success';
  if (score <= 50) return 'text-warning';
  return 'text-danger';
}

function riskBarColor(score: number): string {
  if (score <= 20) return 'bg-success';
  if (score <= 50) return 'bg-warning';
  return 'bg-danger';
}

function scoreBar(score: number, colorCls: string) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorCls} transition-all`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums font-semibold w-6 text-right">{score}</span>
    </div>
  );
}

function initials(name: string): string {
  const clean = formatName(name);
  if (clean === '—') return '??';
  return clean.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClassificationBadge({ cls }: { cls: Classification }) {
  const cfg = CLASSIFICATION_CONFIG[cls] ?? CLASSIFICATION_CONFIG['Neutral'];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: UnitStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['vacant'];
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function FamilyBadge({ label }: { label: string }) {
  const isHeld = label.includes('Held');
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
      isHeld
        ? 'bg-teal-500/10 text-teal-400 border-teal-500/25'
        : 'bg-teal-500/10 text-teal-400 border-teal-500/25'
    }`}>
      <span className="text-[9px]">👪</span>
      {label}
    </span>
  );
}

// ─── Expanded Row Panel ───────────────────────────────────────────────────────

function ExpandedPanel({ unit }: { unit: UnitRecord }) {
  const leaseDate = unit.lease_end_date
    ? new Date(unit.lease_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const familyLabel = FAMILY_UNITS[unit.unit_id];

  return (
    <div className="border-t border-border/40 bg-surface-elevated/40 px-6 py-5">
      {familyLabel && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-teal-500/8 border border-teal-500/20 flex items-center gap-2">
          <span className="text-sm">👪</span>
          <p className="text-xs text-teal-400 font-medium">
            {familyLabel.includes('Held')
              ? 'This unit is intentionally held vacant as part of a family arrangement. Do not treat as a standard leasing opportunity.'
              : `Family unit — part of a multi-apartment arrangement (${familyLabel}). Renew together with units 115, 116, and 318.`
            }
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Financial Detail */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Financial Exposure</p>
          <div className="space-y-2">
            {[
              { label: 'Total Exposure',   val: fmt$(unit.financial_exposure),    cls: unit.financial_exposure > 0 ? 'text-danger font-semibold' : 'text-text-secondary' },
              { label: 'Delinquency',      val: fmt$(unit.delinquency_balance),   cls: unit.delinquency_balance > 0 ? 'text-danger' : 'text-text-muted' },
              { label: 'Aged Receivables', val: fmt$(unit.ar_balance),            cls: unit.ar_balance > 0 ? 'text-warning' : 'text-text-muted' },
              { label: 'Max Days Overdue', val: unit.max_days_overdue > 0 ? `${unit.max_days_overdue}d` : '—', cls: unit.max_days_overdue > 90 ? 'text-danger' : 'text-text-secondary' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                <span className="text-xs text-text-muted">{row.label}</span>
                <span className={`text-xs tabular-nums ${row.cls}`}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lease Info */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Lease Information</p>
          <div className="space-y-2">
            {[
              { label: 'Status',           val: STATUS_CONFIG[unit.unit_status]?.label ?? unit.unit_status, cls: 'text-text-secondary' },
              { label: 'Lease Ends',       val: leaseDate ?? '—', cls: 'text-text-secondary' },
              { label: 'Days to Expiry',   val: unit.days_until_expiration !== null ? `${unit.days_until_expiration}d` : '—',
                cls: unit.days_until_expiration !== null && unit.days_until_expiration <= 30 ? 'text-danger font-semibold' :
                     unit.days_until_expiration !== null && unit.days_until_expiration <= 60 ? 'text-warning' : 'text-text-secondary' },
              { label: 'Tenant',           val: formatName(unit.tenant_name), cls: 'text-text-secondary' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                <span className="text-xs text-text-muted">{row.label}</span>
                <span className={`text-xs ${row.cls}`}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Scores */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Performance Scores</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-text-muted">Risk</span>
                <span className={`text-xs font-semibold tabular-nums ${riskColor(unit.risk_score)}`}>{unit.risk_score}/100</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${riskBarColor(unit.risk_score)} transition-all`} style={{ width: `${unit.risk_score}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-text-muted">Stability</span>
                <span className="text-xs font-semibold tabular-nums text-text-secondary">{unit.stability_score}/100</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${unit.stability_score}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-text-muted">Profitability</span>
                <span className="text-xs font-semibold tabular-nums text-text-secondary">{unit.profitability_score}/100</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-accent/70 transition-all" style={{ width: `${unit.profitability_score}%` }} />
              </div>
            </div>
            <div className="pt-1">
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Turnover Events</span>
                <span className={`text-xs font-semibold tabular-nums ${unit.turnover_count >= 3 ? 'text-danger' : unit.turnover_count >= 2 ? 'text-warning' : 'text-text-secondary'}`}>
                  {unit.turnover_count}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Classification Breakdown Mini-chart ─────────────────────────────────────

function ClassificationBar({ breakdown, total }: { breakdown: Partial<Record<Classification, number>>; total: number }) {
  const order: Classification[] = ['High Risk Unit', 'Vacancy Risk', 'Turnover Heavy', 'Neutral', 'Stable Performer'];
  const colors: Record<Classification, string> = {
    'High Risk Unit':   'bg-danger',
    'Vacancy Risk':     'bg-orange-400',
    'Turnover Heavy':   'bg-purple-400',
    'Neutral':          'bg-surface-elevated border border-border/60',
    'Stable Performer': 'bg-success',
  };

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        {order.map(cls => {
          const count = breakdown[cls] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={cls} className={`${colors[cls]} transition-all`} style={{ width: `${pct}%` }} title={`${cls}: ${count}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {order.map(cls => {
          const count = breakdown[cls] ?? 0;
          if (count === 0) return null;
          const cfg = CLASSIFICATION_CONFIG[cls];
          return (
            <div key={cls} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${colors[cls]}`} />
              <span className="text-xs text-text-muted">{cfg.label}</span>
              <span className="text-xs font-semibold text-text-secondary tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UnitIntelligenceContent() {
  const [data, setData]           = useState<UnitRecord[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Filters & sort
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState<SortField>('risk_score');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');
  const [filterStatus, setFilterStatus]     = useState<UnitStatus | ''>('');
  const [filterClass, setFilterClass]       = useState<Classification | ''>('');
  const [page, setPage]           = useState(0);

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter panel
  const [showFilters, setShowFilters] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const buildUrl = useCallback((overrides: Record<string, string | number> = {}) => {
    const params = new URLSearchParams({
      limit:   String(PAGE_SIZE),
      offset:  String(page * PAGE_SIZE),
      sort_by: sortBy,
      sort_dir: sortDir,
      ...(filterStatus ? { unit_status: filterStatus } : {}),
      ...(filterClass  ? { classification: filterClass } : {}),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    });
    return `/api/proxy?_path=/api/v1/insights/unit-intelligence&${params}`;
  }, [page, sortBy, sortDir, filterStatus, filterClass]);

  const fetchData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl());
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json.data);
      setSummary(json.summary);
      setTotal(json.total);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side search filter
  const filtered = search.trim()
    ? data.filter(r =>
        r.unit_id.toLowerCase().includes(search.toLowerCase()) ||
        formatName(r.tenant_name).toLowerCase().includes(search.toLowerCase()) ||
        r.tenant_name.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const hasActiveFilters = filterStatus || filterClass || search;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(0);
  }

  function clearFilters() {
    setSearch('');
    setFilterStatus('');
    setFilterClass('');
    setPage(0);
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortBy !== field) return <ChevronDown size={11} className="text-text-muted/40" />;
    return sortDir === 'desc'
      ? <ChevronDown size={11} className="text-accent" />
      : <ChevronUp size={11} className="text-accent" />;
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-7">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1.5">Intelligence</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Unit Intelligence</h1>
          <p className="text-text-muted text-sm mt-1.5">
            {total} units · operational + financial risk view
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-7">
          {/* Total Exposure */}
          <div className="bg-surface border border-border/50 rounded-xl p-5">
            <p className="text-xs text-text-muted mb-2">Total Financial Exposure</p>
            <p className="text-2xl font-bold text-danger tabular-nums">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(summary.total_financial_exposure)}
            </p>
            <p className="text-xs text-text-muted mt-1">across {total} units</p>
          </div>

          {/* Avg Risk */}
          <div className="bg-surface border border-border/50 rounded-xl p-5">
            <p className="text-xs text-text-muted mb-2">Avg Risk Score</p>
            <p className={`text-2xl font-bold tabular-nums ${riskColor(summary.avg_risk_score)}`}>
              {summary.avg_risk_score}<span className="text-sm font-normal text-text-muted">/100</span>
            </p>
            <div className="mt-2 h-1 bg-surface-elevated rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${riskBarColor(summary.avg_risk_score)}`} style={{ width: `${summary.avg_risk_score}%` }} />
            </div>
          </div>

          {/* Avg Stability */}
          <div className="bg-surface border border-border/50 rounded-xl p-5">
            <p className="text-xs text-text-muted mb-2">Avg Stability Score</p>
            <p className="text-2xl font-bold tabular-nums text-accent">
              {summary.avg_stability_score}<span className="text-sm font-normal text-text-muted">/100</span>
            </p>
            <div className="mt-2 h-1 bg-surface-elevated rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${summary.avg_stability_score}%` }} />
            </div>
          </div>

          {/* Classification Breakdown */}
          <div className="bg-surface border border-border/50 rounded-xl p-5">
            <p className="text-xs text-text-muted mb-3">Classification Breakdown</p>
            <ClassificationBar breakdown={summary.classification_breakdown} total={total} />
          </div>
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search unit or tenant…"
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

        {/* Sort */}
        <div className="flex items-center gap-1.5 bg-surface border border-border/50 rounded-lg px-3 py-2">
          <span className="text-xs text-text-muted">Sort:</span>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value as SortField); setPage(0); }}
            className="text-xs font-medium text-text-primary bg-transparent focus:outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); setPage(0); }}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            {sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
            showFilters || filterStatus || filterClass
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-surface border-border/50 text-text-muted hover:text-text-secondary'
          }`}
        >
          <SlidersHorizontal size={13} />
          Filters
          {(filterStatus || filterClass) && (
            <span className="w-4 h-4 rounded-full bg-accent text-white text-xs flex items-center justify-center font-bold leading-none">
              {[filterStatus, filterClass].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-danger transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        {/* Result count */}
        <span className="ml-auto text-xs text-text-muted tabular-nums">
          {search ? `${filtered.length} of ${data.length}` : `${data.length} of ${total}`} units
        </span>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex items-center gap-4 mb-5 px-4 py-3 bg-surface border border-border/40 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Status:</span>
            <div className="flex gap-1.5">
              {(['', 'occupied', 'vacant', 'notice'] as const).map(s => (
                <button
                  key={s || 'all'}
                  onClick={() => { setFilterStatus(s as UnitStatus | ''); setPage(0); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    filterStatus === s
                      ? 'bg-accent/10 border-accent/30 text-accent font-medium'
                      : 'border-border/40 text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {s === '' ? 'All' : STATUS_CONFIG[s as UnitStatus].label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-5 bg-border/40" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-text-muted">Class:</span>
            <div className="flex gap-1.5 flex-wrap">
              {(['', ...CLASSIFICATIONS] as const).map(c => (
                <button
                  key={c || 'all'}
                  onClick={() => { setFilterClass(c as Classification | ''); setPage(0); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    filterClass === c
                      ? 'bg-accent/10 border-accent/30 text-accent font-medium'
                      : 'border-border/40 text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {c === '' ? 'All' : CLASSIFICATION_CONFIG[c as Classification].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[3rem_6rem_1fr_7rem_6rem_6rem_6rem_5rem_8rem_6rem] gap-0 border-b border-border/40 px-4">
          {[
            { label: '#',            field: null,                  cls: 'text-center' },
            { label: 'Unit',         field: null,                  cls: '' },
            { label: 'Tenant',       field: null,                  cls: '' },
            { label: 'Exposure',     field: 'financial_exposure' as SortField, cls: 'text-right' },
            { label: 'Risk',         field: 'risk_score' as SortField,         cls: 'text-center' },
            { label: 'Stability',    field: 'stability_score' as SortField,    cls: 'text-center' },
            { label: 'Profit',       field: 'profitability_score' as SortField,cls: 'text-center' },
            { label: 'Turns',        field: null,                  cls: 'text-center' },
            { label: 'Class',        field: null,                  cls: '' },
            { label: 'Expires',      field: null,                  cls: 'text-right' },
          ].map((col, i) => (
            <div
              key={i}
              onClick={() => col.field && toggleSort(col.field)}
              className={`flex items-center gap-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted ${col.cls} ${col.field ? 'cursor-pointer hover:text-text-secondary transition-colors select-none' : ''}`}
            >
              {col.label}
              {col.field && <SortIndicator field={col.field} />}
            </div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="divide-y divide-border/30">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grid grid-cols-[3rem_6rem_1fr_7rem_6rem_6rem_6rem_5rem_8rem_6rem] gap-0 px-4 py-3.5 animate-pulse">
                <div className="h-5 w-5 bg-surface-elevated rounded-full mx-auto" />
                <div className="h-4 bg-surface-elevated rounded w-10" />
                <div className="h-4 bg-surface-elevated rounded w-32" />
                <div className="h-4 bg-surface-elevated rounded w-14 ml-auto" />
                <div className="h-4 bg-surface-elevated rounded w-10 mx-auto" />
                <div className="h-3 bg-surface-elevated rounded w-full mx-2" />
                <div className="h-3 bg-surface-elevated rounded w-full mx-2" />
                <div className="h-4 bg-surface-elevated rounded w-6 mx-auto" />
                <div className="h-5 bg-surface-elevated rounded-full w-20" />
                <div className="h-4 bg-surface-elevated rounded w-12 ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-center">
            <div>
              <p className="text-sm font-medium text-danger mb-1">Failed to load</p>
              <p className="text-xs text-text-muted">{error}</p>
              <button onClick={() => fetchData()} className="mt-3 text-xs text-accent hover:underline">Retry</button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 size={28} className="text-text-muted mb-3" />
            <p className="text-sm font-medium text-text-primary">No units found</p>
            <p className="text-xs text-text-muted mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((unit, idx) => {
              const isExpanded = expandedId === unit.unit_id;
              const rowNum = page * PAGE_SIZE + idx + 1;
              const isHighRisk = unit.classification === 'High Risk Unit';

              return (
                <React.Fragment key={unit.unit_id}>
                  {/* Main row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : unit.unit_id)}
                    className={`group cursor-pointer transition-colors
                      ${isHighRisk ? 'bg-danger/3 border-l-2 border-l-danger' : FAMILY_UNITS[unit.unit_id] ? 'border-l-2 border-l-teal-500/40' : ''}
                      ${isExpanded ? 'bg-surface-elevated/60' : 'hover:bg-surface-elevated/40'}
                    `}
                  >
                    {/* Mobile layout */}
                    <div className="md:hidden px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                            ${isHighRisk ? 'bg-danger/15 text-danger' : 'bg-surface-elevated text-text-secondary'}`}>
                            {initials(unit.tenant_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">Unit {unit.unit_id}</p>
                            <p className="text-xs text-text-muted">{formatName(unit.tenant_name)}</p>
                          </div>
                        </div>
                        {FAMILY_UNITS[unit.unit_id] && unit.unit_status === 'vacant'
                          ? <FamilyBadge label={FAMILY_UNITS[unit.unit_id]} />
                          : <ClassificationBadge cls={unit.classification} />
                        }
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <StatusBadge status={unit.unit_status} />
                        {FAMILY_UNITS[unit.unit_id] && unit.unit_status !== 'vacant' && (
                          <FamilyBadge label={FAMILY_UNITS[unit.unit_id]} />
                        )}
                        {unit.financial_exposure > 0 && (
                          <span className="text-xs font-semibold text-danger tabular-nums">{fmt$(unit.financial_exposure)}</span>
                        )}
                        <span className={`text-xs font-semibold tabular-nums ${riskColor(unit.risk_score)}`}>Risk {unit.risk_score}</span>
                        {unit.days_until_expiration !== null && (
                          <span className={`text-xs tabular-nums ${unit.days_until_expiration <= 30 ? 'text-danger font-semibold' : unit.days_until_expiration <= 60 ? 'text-warning' : 'text-text-muted'}`}>
                            {unit.days_until_expiration}d
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden md:grid grid-cols-[3rem_6rem_1fr_7rem_6rem_6rem_6rem_5rem_8rem_6rem] gap-0 px-4 py-3">
                      {/* Row # */}
                      <div className="flex items-center justify-center">
                        <span className="text-xs tabular-nums text-text-muted/50">{rowNum}</span>
                      </div>

                      {/* Unit ID */}
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                          ${isHighRisk ? 'bg-danger/15 text-danger' : unit.unit_status === 'vacant' ? 'bg-warning/10 text-warning' : 'bg-surface-elevated text-text-secondary'}`}>
                          {unit.unit_id.slice(0, 3)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text-primary">{unit.unit_id}</p>
                          <StatusBadge status={unit.unit_status} />
                        </div>
                      </div>

                      {/* Tenant */}
                      <div className="flex items-center min-w-0 pr-2">
                        <p className="text-xs text-text-secondary truncate">{formatName(unit.tenant_name)}</p>
                      </div>

                      {/* Financial Exposure */}
                      <div className="flex items-center justify-end">
                        <span className={`text-xs font-semibold tabular-nums ${unit.financial_exposure > 0 ? 'text-danger' : 'text-text-muted'}`}>
                          {fmt$(unit.financial_exposure)}
                        </span>
                      </div>

                      {/* Risk Score */}
                      <div className="flex items-center justify-center">
                        <span className={`text-sm font-bold tabular-nums ${riskColor(unit.risk_score)}`}>{unit.risk_score}</span>
                      </div>

                      {/* Stability */}
                      <div className="flex items-center px-2">
                        {scoreBar(unit.stability_score, 'bg-accent')}
                      </div>

                      {/* Profitability */}
                      <div className="flex items-center px-2">
                        {scoreBar(unit.profitability_score, 'bg-accent/60')}
                      </div>

                      {/* Turnover Count */}
                      <div className="flex items-center justify-center">
                        <span className={`text-xs font-semibold tabular-nums ${
                          unit.turnover_count >= 3 ? 'text-danger' :
                          unit.turnover_count >= 2 ? 'text-warning' :
                          'text-text-muted'}`}>
                          {unit.turnover_count}
                        </span>
                      </div>

                      {/* Classification */}
                      <div className="flex flex-col gap-1 items-start">
                        {FAMILY_UNITS[unit.unit_id] && unit.unit_status === 'vacant'
                          ? <FamilyBadge label={FAMILY_UNITS[unit.unit_id]} />
                          : <ClassificationBadge cls={unit.classification} />
                        }
                        {FAMILY_UNITS[unit.unit_id] && unit.unit_status !== 'vacant' && (
                          <FamilyBadge label={FAMILY_UNITS[unit.unit_id]} />
                        )}
                      </div>

                      {/* Days to Expiration */}
                      <div className="flex items-center justify-end">
                        {unit.days_until_expiration !== null ? (
                          <span className={`text-xs font-medium tabular-nums ${
                            unit.days_until_expiration <= 30 ? 'text-danger font-semibold' :
                            unit.days_until_expiration <= 60 ? 'text-warning' :
                            'text-text-muted'}`}>
                            {unit.days_until_expiration}d
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted/40">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Panel */}
                  {isExpanded && <ExpandedPanel unit={unit} />}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────── */}
      {!loading && totalPages > 1 && !search && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-text-muted tabular-nums">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} units
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs rounded-lg border border-border/50 text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded-md transition-colors ${p === page
                      ? 'bg-accent/15 text-accent border border-accent/30 font-medium'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated border border-transparent'}`}
                  >
                    {p + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-border/50 text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
