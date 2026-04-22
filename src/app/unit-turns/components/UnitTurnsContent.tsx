'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Home, Clock, DollarSign, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TurnRecord {
  id: string;
  unit_id: string;
  move_out_date: string | null;
  expected_move_in: string | null;
  turnaround_days: number | null;
  total_billed: number | null;
  status: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function TurnaroundBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-text-muted">—</span>;
  const cls = days > 30 ? 'text-danger' : days > 14 ? 'text-warning' : 'text-accent';
  return <span className={`text-sm font-semibold tabular-nums ${cls}`}>{days}d</span>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UnitTurnsContent() {
  const [turns, setTurns]   = useState<TurnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy?_path=/api/jasmine/inspections');
      const json = await res.json();
      setTurns(Array.isArray(json) ? json : json?.data ?? []);
    } catch { setTurns([]); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const avgTurnaround = turns.length
    ? Math.round(turns.filter(t => t.turnaround_days).reduce((s, t) => s + (t.turnaround_days ?? 0), 0) / turns.filter(t => t.turnaround_days).length)
    : null;

  const totalBilled = turns.reduce((s, t) => s + (t.total_billed ?? 0), 0);
  const longTurns   = turns.filter(t => (t.turnaround_days ?? 0) > 30).length;

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Operations</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Unit Turns</h1>
          <p className="text-text-secondary text-sm mt-1.5">Make-ready status and turnaround performance</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Units in Turn', val: turns.length, icon: Home, cls: 'text-text-primary', bg: 'bg-surface-elevated' },
          { label: 'Avg Turnaround', val: avgTurnaround !== null ? `${avgTurnaround}d` : '—', icon: Clock, cls: avgTurnaround && avgTurnaround > 21 ? 'text-warning' : 'text-accent', bg: avgTurnaround && avgTurnaround > 21 ? 'bg-warning/15' : 'bg-accent/15' },
          { label: 'Over 30 Days', val: longTurns, icon: Clock, cls: longTurns > 0 ? 'text-danger' : 'text-text-primary', bg: longTurns > 0 ? 'bg-danger/15' : 'bg-surface-elevated' },
          { label: 'Total Billed', val: fmt$(totalBilled), icon: DollarSign, cls: 'text-text-primary', bg: 'bg-surface-elevated' },
        ].map(({ label, val, icon: Icon, cls, bg }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={14} className={cls} />
              </div>
              <p className="text-xs text-text-secondary">{label}</p>
            </div>
            {loading
              ? <div className="h-8 w-16 bg-surface-elevated animate-pulse rounded" />
              : <p className={`text-2xl font-bold tabular-nums ${cls}`}>{val}</p>
            }
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Unit', 'Move-Out', 'Target Move-In', 'Days Since Move-Out', 'Turnaround', 'Total Billed'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3.5"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-16" /></td>
                  ))}</tr>
                ))
              ) : turns.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">No unit turn records found.</td></tr>
              ) : turns.map(t => {
                const since = daysSince(t.move_out_date);
                const sinceClass = since !== null && since > 30 ? 'text-danger font-semibold' : since !== null && since > 14 ? 'text-warning' : 'text-text-secondary';
                return (
                  <tr key={t.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface-elevated border border-border/40 flex items-center justify-center">
                          <Home size={12} className="text-text-muted" />
                        </div>
                        <span className="text-sm font-semibold text-text-primary">Unit {t.unit_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary tabular-nums">{fmtDate(t.move_out_date)}</td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary tabular-nums">{fmtDate(t.expected_move_in)}</td>
                    <td className="px-4 py-3.5">
                      {since !== null
                        ? <span className={`text-sm tabular-nums ${sinceClass}`}>{since}d ago</span>
                        : <span className="text-xs text-text-muted">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5"><TurnaroundBadge days={t.turnaround_days ?? null} /></td>
                    <td className="px-4 py-3.5 text-sm font-medium text-text-primary tabular-nums">{fmt$(t.total_billed)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
