'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Check, AlertTriangle } from 'lucide-react';
import { getPortfolioExec, PortfolioExecView, PortfolioMetric } from '@/lib/api';

function fmt(value: number | null, unit: string): string {
  if (value == null) return '—';
  if (unit === 'rate') return `${(value * 100).toFixed(1)}%`;
  if (unit === 'currency')
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat('en-US').format(value);
}

function MetricRow({ m }: { m: PortfolioMetric }) {
  const good = m.on_target;
  const VarIcon = m.variance >= 0 ? TrendingUp : TrendingDown;
  return (
    <div
      className={`bg-surface border border-border/50 border-l-2 ${
        good ? 'border-l-accent' : 'border-l-warning'
      } rounded-lg p-4 flex items-center gap-4`}
    >
      <div className="flex-shrink-0">
        {good ? (
          <span className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
            <Check size={14} className="text-accent" />
          </span>
        ) : (
          <span className="w-7 h-7 rounded-full bg-warning/15 flex items-center justify-center">
            <AlertTriangle size={14} className="text-warning" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{m.label}</p>
        <p className="text-[11px] text-text-muted mt-0.5">
          Target {m.direction === 'higher' ? '≥' : '≤'} {fmt(m.target, m.unit)}
          {m.target_is_default && <span className="ml-1 italic">(default)</span>}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`text-lg font-bold tabular-nums ${good ? 'text-text-primary' : 'text-warning'}`}>
          {fmt(m.value, m.unit)}
        </p>
        {m.variance_pct != null && (
          <p className={`text-[11px] flex items-center gap-0.5 justify-end ${m.variance >= 0 ? 'text-accent' : 'text-warning'}`}>
            <VarIcon size={10} />
            {m.variance_pct >= 0 ? '+' : ''}
            {(m.variance_pct * 100).toFixed(0)}% vs target
          </p>
        )}
      </div>
    </div>
  );
}

export default function PortfolioContent() {
  const [view, setView] = useState<PortfolioExecView | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getPortfolioExec();
      setView(v);
      setHasLoaded(true);
    } catch (e) {
      console.error('Portfolio load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen p-6 pt-16 lg:pt-10 lg:p-10 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Portfolio</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Performance vs target</h1>
          <p className="text-text-secondary text-sm mt-1.5">
            {view ? `${view.on_target} on target · ${view.off_target} need attention` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2 hover:border-accent/40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !hasLoaded ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-surface border border-border rounded-lg" />
          ))}
        </div>
      ) : view ? (
        <div className="space-y-2 max-w-3xl">
          {view.metrics.map((m) => (
            <MetricRow key={m.metric_id} m={m} />
          ))}
          <p className="text-[11px] text-text-muted pt-3 leading-snug">
            Targets marked (default) use industry benchmarks. Real budget values can be set per
            metric — off-target items are where the portfolio diverges from where it should be.
          </p>
        </div>
      ) : null}
    </div>
  );
}
