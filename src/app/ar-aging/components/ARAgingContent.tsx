'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, DollarSign } from 'lucide-react';

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

function fmt$(n: number | null): string {
  if (!n && n !== 0) return '—';
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtName(raw: string): string {
  if (!raw) return '—';
  if (raw.includes(',')) {
    const [last, ...first] = raw.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return raw;
}

function BucketBar({ label, amount, total, cls }: { label: string; amount: number; total: number; cls: string }) {
  if (!amount) return null;
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  const barCls = cls.replace('text-', 'bg-');
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-12 text-right tabular-nums font-medium ${cls}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-text-muted tabular-nums w-14 text-right">{fmt$(amount)}</span>
    </div>
  );
}

export default function ARAgingContent() {
  const [records, setRecords] = useState<ARRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket]   = useState('all');

  const load = useCallback(async (b = 'all') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ _path: '/api/jasmine/aged-receivables' });
      if (b !== 'all') params.set('bucket', b);
      const res = await fetch(`/api/proxy?${params}`);
      const json = await res.json();
      setRecords(json?.receivables ?? []);
    } catch { setRecords([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalBalance = records.reduce((s, r) => s + (r.total_amount || 0), 0);
  const total90Plus  = records.reduce((s, r) => s + (r.amount_90_plus || 0), 0);
  const total6190    = records.reduce((s, r) => s + (r.amount_60_to_90 || 0), 0);
  const total030     = records.reduce((s, r) => s + (r.amount_0_to_30 || 0), 0);

  const BUCKETS = [
    { id: 'all', label: 'All' }, { id: '30', label: '0–30d' },
    { id: '60', label: '31–60d' }, { id: '90', label: '61–90d' }, { id: '90_plus', label: '90d+' },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div className="pl-10 lg:pl-0">
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Finance</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">AR Aging</h1>
          <p className="text-text-secondary text-sm mt-1.5">Accounts receivable aging by tenant</p>
        </div>
        <button onClick={() => load(bucket)} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40 flex-shrink-0">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Outstanding', val: totalBalance, cls: 'text-danger',      bg: 'bg-danger/15' },
          { label: '90d+ Overdue',      val: total90Plus,  cls: 'text-danger',      bg: 'bg-danger/15' },
          { label: '61–90d Overdue',    val: total6190,    cls: 'text-warning',     bg: 'bg-warning/15' },
          { label: '0–30d Overdue',     val: total030,     cls: 'text-text-primary',bg: 'bg-surface-elevated' },
        ].map(({ label, val, cls, bg }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}><DollarSign size={13} className={cls} /></div>
              <p className="text-xs text-text-secondary leading-tight">{label}</p>
            </div>
            {loading ? <div className="h-7 w-20 bg-surface-elevated animate-pulse rounded" />
              : <p className={`text-xl sm:text-2xl font-bold tabular-nums ${cls}`}>{fmt$(val)}</p>}
          </div>
        ))}
      </div>

      {/* Bucket filter */}
      <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {BUCKETS.map(b => (
          <button key={b.id} onClick={() => { setBucket(b.id); load(b.id); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${bucket === b.id ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border/50">
                {['Tenant', 'Unit', 'Total', 'Aging Breakdown'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i}>{[...Array(4)].map((_, j) => <td key={j} className="px-4 py-4"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-20" /></td>)}</tr>)
              ) : records.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-text-muted">No AR records found.</td></tr>
              ) : records.map((r, i) => (
                <tr key={i} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-text-primary">{fmtName(r.tenant_name)}</p>
                    {r.tenant_status && <p className="text-xs text-text-muted">{r.tenant_status}</p>}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">{r.unit}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-danger tabular-nums">{fmt$(r.total_amount)}</td>
                  <td className="px-4 py-3.5 min-w-[180px]">
                    <div className="space-y-1">
                      <BucketBar label="0–30d"  amount={r.amount_0_to_30}  total={r.total_amount} cls="text-text-muted" />
                      <BucketBar label="31–60d" amount={r.amount_30_to_60} total={r.total_amount} cls="text-warning" />
                      <BucketBar label="61–90d" amount={r.amount_60_to_90} total={r.total_amount} cls="text-danger" />
                      <BucketBar label="90d+"   amount={r.amount_90_plus}  total={r.total_amount} cls="text-danger" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
