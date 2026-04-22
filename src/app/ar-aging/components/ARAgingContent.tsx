'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ARRecord {
  id: string;
  tenant_id: string;
  unit_id: string;
  total_balance: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  dominant_bucket: string;
  risk_score: number;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (!n && n !== 0) return '—';
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtName(raw: string): string {
  if (!raw) return '—';
  if (/^[A-Z][A-Z\s,.'\-]+$/.test(raw) && raw.includes(',')) {
    const [last, ...first] = raw.split(',').map(s => s.trim());
    return [...first, last].filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  if (/^[a-z][a-z0-9_]+$/.test(raw)) {
    return raw.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return raw;
}

function BucketBar({ label, amount, total, cls }: { label: string; amount: number; total: number; cls: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  if (amount === 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-12 text-right tabular-nums font-medium ${cls}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cls.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-text-muted tabular-nums w-16 text-right">{fmt$(amount)}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ARAgingContent() {
  const [records, setRecords]   = useState<ARRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [bucket, setBucket]     = useState('all');

  const load = useCallback(async (b = 'all') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ _path: '/api/jasmine/aged-receivables' });
      if (b !== 'all') params.set('bucket', b);
      const res = await fetch(`/api/proxy?${params}`);
      const json = await res.json();
      setRecords(Array.isArray(json) ? json : json?.data ?? []);
    } catch { setRecords([]); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBucket = (b: string) => { setBucket(b); load(b); };

  const totalBalance = records.reduce((s, r) => s + r.total_balance, 0);
  const total90Plus  = records.reduce((s, r) => s + r.bucket_90_plus, 0);
  const total6190    = records.reduce((s, r) => s + r.bucket_61_90, 0);
  const total3160    = records.reduce((s, r) => s + r.bucket_31_60, 0);
  const total030     = records.reduce((s, r) => s + r.bucket_0_30, 0);

  const BUCKETS = [
    { id: 'all',     label: 'All' },
    { id: '30',      label: '0–30d' },
    { id: '60',      label: '31–60d' },
    { id: '90',      label: '61–90d' },
    { id: '90_plus', label: '90d+' },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Finance</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">AR Aging</h1>
          <p className="text-text-secondary text-sm mt-1.5">Accounts receivable aging by tenant and bucket</p>
        </div>
        <button onClick={() => load(bucket)} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Outstanding', val: totalBalance, cls: 'text-danger', bg: 'bg-danger/15' },
          { label: '90d+ Overdue',      val: total90Plus,  cls: 'text-danger', bg: 'bg-danger/15' },
          { label: '61–90d Overdue',    val: total6190,    cls: 'text-warning', bg: 'bg-warning/15' },
          { label: '0–30d Overdue',     val: total030,     cls: 'text-text-primary', bg: 'bg-surface-elevated' },
        ].map(({ label, val, cls, bg }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <DollarSign size={14} className={cls} />
              </div>
              <p className="text-xs text-text-secondary">{label}</p>
            </div>
            {loading
              ? <div className="h-8 w-20 bg-surface-elevated animate-pulse rounded" />
              : <p className={`text-2xl font-bold tabular-nums ${cls}`}>{fmt$(val)}</p>
            }
          </div>
        ))}
      </div>

      {/* Bucket filter */}
      <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1 mb-6 w-fit">
        {BUCKETS.map(b => (
          <button key={b.id} onClick={() => handleBucket(b.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              bucket === b.id ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Tenant', 'Unit', 'Total Balance', 'Aging Breakdown', 'Risk Score'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-20" /></td>
                  ))}</tr>
                ))
              ) : records.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-text-muted">No AR records found.</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-text-primary">{fmtName(r.tenant_id)}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">{r.unit_id}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-danger tabular-nums">{fmt$(r.total_balance)}</p>
                  </td>
                  <td className="px-4 py-3.5 min-w-[200px]">
                    <div className="space-y-1">
                      <BucketBar label="0–30d"  amount={r.bucket_0_30}   total={r.total_balance} cls="text-text-muted" />
                      <BucketBar label="31–60d" amount={r.bucket_31_60}  total={r.total_balance} cls="text-warning" />
                      <BucketBar label="61–90d" amount={r.bucket_61_90}  total={r.total_balance} cls="text-danger" />
                      <BucketBar label="90d+"   amount={r.bucket_90_plus} total={r.total_balance} cls="text-danger" />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 bg-surface-elevated rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.risk_score >= 70 ? 'bg-danger' : r.risk_score >= 40 ? 'bg-warning' : 'bg-accent'}`}
                          style={{ width: `${Math.min(r.risk_score, 100)}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-text-secondary">{r.risk_score}</span>
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
