'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowUpRight, DollarSign } from 'lucide-react';
import { getCollections, CollectionsView } from '@/lib/api';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const STAGE_ACCENT: Record<string, string> = {
  current_due: 'border-l-border',
  early: 'border-l-accent',
  serious: 'border-l-warning',
  severe: 'border-l-danger',
};

export default function CollectionsContent() {
  const [view, setView] = useState<CollectionsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getCollections();
      setView(v);
      setHasLoaded(true);
    } catch (e) {
      console.error('Collections load failed:', e);
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
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Collections</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Collections</h1>
          <p className="text-text-secondary text-sm mt-1.5">Outstanding balances by stage</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2 hover:border-accent/40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !hasLoaded ? (
        <div className="h-32 animate-pulse bg-surface border border-border rounded-xl mb-8" />
      ) : view ? (
        <>
          {/* Headline */}
          <div className="bg-surface border border-border/50 rounded-xl p-6 mb-8 max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-accent" />
              <p className="text-xs text-text-secondary">{view.headline.label}</p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-text-primary">
              {fmtCurrency(view.headline.value)}
            </p>
            <p className="text-xs text-text-muted mt-1">
              across {view.headline.tenants} tenants
            </p>
            <p className="text-[11px] text-text-muted mt-2 leading-snug">{view.headline.note}</p>
          </div>

          {/* Stages */}
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-4">By stage</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {(['current_due', 'early', 'serious', 'severe'] as const).map((key) => {
              const s = view.stages[key];
              if (!s) return null;
              return (
                <div
                  key={key}
                  className={`bg-surface border border-border/50 border-l-2 ${STAGE_ACCENT[key]} rounded-xl p-4`}
                >
                  <p className="text-xs text-text-secondary leading-tight mb-2">{s.label}</p>
                  <p className="text-2xl font-bold tabular-nums text-text-primary">{s.value}</p>
                  {s.amount != null && s.amount > 0 && (
                    <p className="text-[11px] text-text-muted mt-1">{fmtCurrency(s.amount)}</p>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href="/insights"
            className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
          >
            Open collections detail <ArrowUpRight size={11} />
          </Link>
        </>
      ) : null}
    </div>
  );
}
