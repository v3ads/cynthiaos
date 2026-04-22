'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Raw record from API (one per GL account per tenant) ─────────────────────
interface ARRecord {
  unit: string;
  tenant_name: string;
  tenant_status: string | null;
  amount_0_to_30: number;
  amount_30_to_60: number;
  amount_60_to_90: number;
  amount_90_plus: number;
  total_amount: number;
  gl_account: string | null;
}

// ─── Grouped by unit + tenant ─────────────────────────────────────────────────
interface TenantAR {
  unit: string;
  tenant_name: string;
  tenant_status: string | null;
  amount_0_to_30: number;
  amount_30_to_60: number;
  amount_60_to_90: number;
  amount_90_plus: number;
  total_amount: number;
  gl_accounts: { name: string; total: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (!n && n !== 0) return '—';
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function fmtName(raw: string): string {
  if (!raw) return '—';
  if (raw.includes(',')) {
    const [last, ...first] = raw.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return raw;
}

// Group raw rows by unit+tenant, summing all bucket columns
function groupByTenant(records: ARRecord[]): TenantAR[] {
  const map = new Map<string, TenantAR>();
  for (const r of records) {
    const key = `${r.unit}__${r.tenant_name}`;
    if (!map.has(key)) {
      map.set(key, {
        unit: r.unit,
        tenant_name: r.tenant_name,
        tenant_status: r.tenant_status,
        amount_0_to_30:  0,
        amount_30_to_60: 0,
        amount_60_to_90: 0,
        amount_90_plus:  0,
        total_amount:    0,
        gl_accounts: [],
      });
    }
    const t = map.get(key)!;
    t.amount_0_to_30  += r.amount_0_to_30  || 0;
    t.amount_30_to_60 += r.amount_30_to_60 || 0;
    t.amount_60_to_90 += r.amount_60_to_90 || 0;
    t.amount_90_plus  += r.amount_90_plus  || 0;
    t.total_amount    += r.total_amount    || 0;
    if (r.gl_account && r.total_amount) {
      const existing = t.gl_accounts.find(g => g.name === r.gl_account);
      if (existing) {
        existing.total += r.total_amount;
      } else {
        t.gl_accounts.push({ name: r.gl_account, total: r.total_amount });
      }
    }
  }
  // Sort by total descending
  return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);
}

function BucketBar({ label, amount, total, cls }: {
  label: string; amount: number; total: number; cls: string;
}) {
  if (!amount) return null;
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  const barCls = cls.replace('text-', 'bg-');
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-12 text-right tabular-nums font-medium flex-shrink-0 ${cls}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-text-muted tabular-nums w-14 text-right flex-shrink-0">{fmt$(amount)}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ARAgingContent() {
  const [raw,        setRaw]        = useState<ARRecord[]>([]);
  const [apiTotal,   setApiTotal]   = useState<number>(0);
  const [loading,    setLoading]    = useState(true);
  const [bucket,     setBucket]     = useState('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async (b = 'all') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ _path: '/api/jasmine/aged-receivables' });
      if (b !== 'all') params.set('bucket', b);
      const res  = await fetch(`/api/proxy?${params}`);
      const json = await res.json();
      setRaw(json?.receivables ?? []);
      setApiTotal(json?.total_outstanding ?? 0);
    } catch { setRaw([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = groupByTenant(raw);

  // Summary totals — use API's authoritative total_outstanding for the top card
  // Re-derive bucket totals by summing grouped rows (accurate after de-duplication)
  const total90Plus = grouped.reduce((s, r) => s + r.amount_90_plus,  0);
  const total6190   = grouped.reduce((s, r) => s + r.amount_60_to_90, 0);
  const total030    = grouped.reduce((s, r) => s + r.amount_0_to_30,  0);

  const BUCKETS = [
    { id: 'all',     label: 'All' },
    { id: '30',      label: '0–30d' },
    { id: '60',      label: '31–60d' },
    { id: '90',      label: '61–90d' },
    { id: '90_plus', label: '90d+' },
  ];

  return (
    <div className="min-h-screen p-4 pt-16 sm:pt-16 lg:pt-10 sm:p-6 lg:p-10 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div className="">
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Finance</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">AR Aging</h1>
          <p className="text-text-secondary text-sm mt-1.5">
            Accounts receivable aging — {grouped.length} tenants across {new Set(raw.map(r => r.unit)).size} units
          </p>
        </div>
        <button
          onClick={() => load(bucket)} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Outstanding', val: apiTotal,   cls: 'text-danger',       bg: 'bg-danger/15' },
          { label: '90d+ Overdue',      val: total90Plus, cls: 'text-danger',       bg: 'bg-danger/15' },
          { label: '61–90d Overdue',    val: total6190,   cls: 'text-warning',      bg: 'bg-warning/15' },
          { label: '0–30d Overdue',     val: total030,    cls: 'text-text-primary', bg: 'bg-surface-elevated' },
        ].map(({ label, val, cls, bg }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <DollarSign size={13} className={cls} />
              </div>
              <p className="text-xs text-text-secondary leading-tight">{label}</p>
            </div>
            {loading
              ? <div className="h-7 w-20 bg-surface-elevated animate-pulse rounded" />
              : <p className={`text-xl sm:text-2xl font-bold tabular-nums ${cls}`}>{fmt$(val)}</p>
            }
          </div>
        ))}
      </div>

      {/* Bucket filter */}
      <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1 mb-6 w-fit">
        {BUCKETS.map(b => (
          <button
            key={b.id}
            onClick={() => { setBucket(b.id); load(b.id); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              bucket === b.id ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Table — one row per tenant, expandable to show GL account breakdown */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="border-b border-border/50">
                {['Tenant', 'Unit', 'Total', 'Aging Breakdown'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3.5 bg-surface-elevated animate-pulse rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : grouped.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-text-muted">
                    No AR records found.
                  </td>
                </tr>
              ) : grouped.map(r => {
                const key = `${r.unit}__${r.tenant_name}`;
                const isExpanded = expandedKey === key;
                const hasBreakdown = r.gl_accounts.length > 1;

                return (
                  <React.Fragment key={key}>
                    <tr
                      className={`transition-colors ${hasBreakdown ? 'cursor-pointer hover:bg-surface-elevated/40' : 'hover:bg-surface-elevated/20'} ${isExpanded ? 'bg-surface-elevated/40' : ''}`}
                      onClick={() => hasBreakdown && setExpandedKey(isExpanded ? null : key)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {hasBreakdown && (
                            <span className="text-text-muted flex-shrink-0">
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                          )}
                          <div>
                            <p className="text-sm font-medium text-text-primary">{fmtName(r.tenant_name)}</p>
                            {r.tenant_status && (
                              <p className="text-xs text-text-muted">{r.tenant_status}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">{r.unit}</td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-danger tabular-nums">{fmt$(r.total_amount)}</p>
                      </td>
                      <td className="px-4 py-3.5 min-w-[180px]">
                        <div className="space-y-1">
                          <BucketBar label="0–30d"  amount={r.amount_0_to_30}  total={r.total_amount} cls="text-text-muted" />
                          <BucketBar label="31–60d" amount={r.amount_30_to_60} total={r.total_amount} cls="text-warning" />
                          <BucketBar label="61–90d" amount={r.amount_60_to_90} total={r.total_amount} cls="text-danger" />
                          <BucketBar label="90d+"   amount={r.amount_90_plus}  total={r.total_amount} cls="text-danger" />
                        </div>
                      </td>
                    </tr>

                    {/* GL account breakdown — expanded */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="px-4 pb-3 bg-surface-elevated/30">
                          <div className="ml-5 space-y-1 pt-1 border-t border-border/30">
                            {r.gl_accounts.map(g => (
                              <div key={g.name} className="flex items-center justify-between py-1">
                                <span className="text-xs text-text-secondary">{g.name}</span>
                                <span className="text-xs font-medium text-text-primary tabular-nums">{fmt$(g.total)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
