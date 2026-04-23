'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Home, Clock, DollarSign } from 'lucide-react';

interface TurnRecord {
  unit_id: string;
  move_out_date: string | null;
  expected_move_in_date: string | null;
  turn_end_date: string | null;
  days_to_complete: number | null;
  target_days: number | null;
  total_billed: number | null;
}

function fmt$(n: number | null): string {
  if (!n && n !== 0) return '—';
  if (n === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

export default function UnitTurnsContent() {
  const [turns,   setTurns]   = useState<TurnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/proxy?_path=/api/pages/unit-turns');
      const json = await res.json();
      setTurns(json?.turns ?? []);
    } catch { setTurns([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const completed  = turns.filter(t => t.days_to_complete !== null);
  const inProgress = turns.filter(t => t.days_to_complete === null && t.move_out_date);
  const avgTurn    = completed.length ? Math.round(completed.reduce((s, t) => s + (t.days_to_complete ?? 0), 0) / completed.length) : null;
  const longTurns  = completed.filter(t => (t.days_to_complete ?? 0) > 30).length;

  return (
    <div className="min-h-screen p-4 pt-16 sm:pt-16 lg:pt-10 sm:p-6 lg:p-10 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Operations</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">Unit Turns</h1>
          <p className="text-text-secondary text-sm mt-1.5">Make-ready history and turnaround performance</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40 flex-shrink-0">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Records',    val: turns.length,    icon: Home,  cls: 'text-text-primary', bg: 'bg-surface-elevated' },
          { label: 'In Progress',      val: inProgress.length, icon: Clock, cls: 'text-warning',   bg: 'bg-warning/15' },
          { label: 'Avg Turnaround',   val: avgTurn !== null ? `${avgTurn}d` : '—', icon: Clock, cls: avgTurn && avgTurn > 21 ? 'text-warning' : 'text-accent', bg: avgTurn && avgTurn > 21 ? 'bg-warning/15' : 'bg-accent/15' },
          { label: 'Over 30 Days',     val: longTurns,       icon: Clock, cls: longTurns > 0 ? 'text-danger' : 'text-text-primary', bg: longTurns > 0 ? 'bg-danger/15' : 'bg-surface-elevated' },
        ].map(({ label, val, icon: Icon, cls, bg }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}><Icon size={13} className={cls} /></div>
              <p className="text-xs text-text-secondary">{label}</p>
            </div>
            {loading ? <div className="h-7 w-12 bg-surface-elevated animate-pulse rounded" />
              : <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${cls}`}>{val}</p>}
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border/50">
                {['Unit', 'Move-Out', 'Expected Move-In', 'Target', 'Actual', 'Billed', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(6)].map((_, i) => <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3.5"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-16" /></td>)}</tr>)
              ) : turns.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-text-muted">No unit turn records found.</td></tr>
              ) : turns.map((t, i) => {
                const actual = t.days_to_complete;
                const inProg = actual === null && !!t.move_out_date;
                const actualCls = actual === null ? 'text-text-muted' : actual > 30 ? 'text-danger font-semibold' : actual > 14 ? 'text-warning' : 'text-accent';
                return (
                  <tr key={i} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface-elevated border border-border/40 flex items-center justify-center flex-shrink-0">
                          <Home size={12} className="text-text-muted" />
                        </div>
                        <span className="text-sm font-semibold text-text-primary">{t.unit_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary tabular-nums whitespace-nowrap">{fmtDate(t.move_out_date)}</td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary tabular-nums whitespace-nowrap">{fmtDate(t.expected_move_in_date)}</td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary tabular-nums">{t.target_days ? `${t.target_days}d` : '—'}</td>
                    <td className="px-4 py-3.5">
                      {actual !== null ? <span className={`text-sm tabular-nums ${actualCls}`}>{actual}d</span>
                        : <span className="text-xs text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-text-primary tabular-nums">{fmt$(t.total_billed)}</td>
                    <td className="px-4 py-3.5">
                      {inProg
                        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/25">In Progress</span>
                        : actual !== null
                          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25">Complete</span>
                          : <span className="text-xs text-text-muted">—</span>
                      }
                    </td>
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
