'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowUpRight, Wrench, Home } from 'lucide-react';
import { getOperations, OperationsView } from '@/lib/api';

function StateCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-text-secondary leading-tight mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-text-primary">{value}</p>
      {href && (
        <span className="mt-auto pt-3 inline-flex items-center gap-0.5 text-[11px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View <ArrowUpRight size={11} />
        </span>
      )}
    </>
  );
  return href ? (
    <Link
      href={href}
      className={`group bg-surface border border-border/50 ${accent ?? ''} rounded-xl p-4 flex flex-col hover:border-accent/40 transition-colors`}
    >
      {body}
    </Link>
  ) : (
    <div className={`bg-surface border border-border/50 ${accent ?? ''} rounded-xl p-4 flex flex-col`}>{body}</div>
  );
}

export default function OperationsContent() {
  const [view, setView] = useState<OperationsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getOperations();
      setView(v);
      setHasLoaded(true);
    } catch (e) {
      console.error('Operations load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const m = (k: string) => {
    const v = view?.maintenance?.[k];
    return typeof v === 'object' ? v : null;
  };

  return (
    <div className="min-h-screen p-6 pt-16 lg:pt-10 lg:p-10 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Operations</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Operations</h1>
          <p className="text-text-secondary text-sm mt-1.5">Maintenance and unit turns</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2 hover:border-accent/40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !hasLoaded ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse bg-surface border border-border rounded-xl" />
          ))}
        </div>
      ) : view ? (
        <>
          {/* Maintenance */}
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={14} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Maintenance · {view.maintenance.total as number} work orders
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
            {m('open') && <StateCard label={m('open')!.label} value={m('open')!.value} accent={m('open')!.value > 15 ? 'border-l-2 border-l-warning' : ''} href="/maintenance" />}
            {m('new_unassigned') && <StateCard label={m('new_unassigned')!.label} value={m('new_unassigned')!.value} href="/maintenance" />}
            {m('in_progress') && <StateCard label={m('in_progress')!.label} value={m('in_progress')!.value} href="/maintenance" />}
            {m('completed') && <StateCard label={m('completed')!.label} value={m('completed')!.value} href="/maintenance" />}
          </div>

          {/* Turns */}
          <div className="flex items-center gap-2 mb-4">
            <Home size={14} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Unit turns</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StateCard
              label={view.turns.in_progress.label}
              value={view.turns.in_progress.value}
              href="/unit-turns"
            />
            <StateCard
              label={view.turns.overdue.label}
              value={view.turns.overdue.value}
              accent={view.turns.overdue.value > 0 ? 'border-l-2 border-l-danger' : ''}
              href="/unit-turns"
            />
            <StateCard
              label={view.turns.scheduled.label}
              value={view.turns.scheduled.value}
              href="/unit-turns"
            />
            <StateCard
              label={view.turns.completed.label}
              value={view.turns.completed.value}
              href="/unit-turns"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
