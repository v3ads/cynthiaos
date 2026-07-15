'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Check,
  Clock,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  getToday,
  transitionAction,
  TodayView,
  ActionItem,
  TodayOutcome,
  MetricConfidence,
} from '@/lib/api';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtInt = (v: number) => new Intl.NumberFormat('en-US').format(v);

const CONF: Record<MetricConfidence, { badge: string; icon: React.ElementType }> = {
  trusted: { badge: 'bg-accent/10 text-accent border-accent/25', icon: ShieldCheck },
  warning: { badge: 'bg-warning/10 text-warning border-warning/30', icon: AlertTriangle },
  blocked: { badge: 'bg-danger/10 text-danger border-danger/30', icon: Ban },
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'border-l-danger',
  normal: 'border-l-accent',
  low: 'border-l-border',
};

function OutcomeCard({ o }: { o: TodayOutcome }) {
  const conf = CONF[o.confidence];
  const ConfIcon = conf.icon;
  return (
    <Link
      href={o.drilldown_url}
      className="group bg-surface border border-border/50 rounded-xl p-4 sm:p-5 flex flex-col hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-text-secondary leading-tight">{o.label}</p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${conf.badge}`}>
          <ConfIcon size={9} />
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-text-primary">
        {o.unit === 'currency' ? fmtCurrency(o.value) : fmtInt(o.value)}
      </p>
      <p className="text-[11px] text-text-muted mt-1 leading-snug">{o.sub}</p>
      <span className="mt-auto pt-3 inline-flex items-center gap-0.5 text-[11px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
        View detail <ArrowUpRight size={11} />
      </span>
    </Link>
  );
}

function QueueRow({
  a,
  onTransition,
}: {
  a: ActionItem;
  onTransition: (id: string, status: string) => void;
}) {
  return (
    <div className={`bg-surface border border-border/50 border-l-2 ${PRIORITY_STYLE[a.priority] ?? 'border-l-border'} rounded-lg p-3.5 flex items-start gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-text-primary">{a.title}</p>
          {a.impact_label && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border/50">
              {a.impact_label}
            </span>
          )}
          {a.due_at && (
            <span className="text-[10px] text-text-muted">
              due {new Date(a.due_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {a.detail && <p className="text-xs text-text-secondary mt-1 leading-snug">{a.detail}</p>}
        {a.next_action && (
          <p className="text-[11px] text-accent mt-1.5">→ {a.next_action}</p>
        )}
        <p className="text-[10px] text-text-muted mt-1.5">Owner: {a.owner}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onTransition(a.action_id, 'done')}
          title="Mark done"
          className="p-1.5 rounded-md hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => onTransition(a.action_id, 'snoozed')}
          title="Snooze"
          className="p-1.5 rounded-md hover:bg-warning/10 text-text-muted hover:text-warning transition-colors"
        >
          <Clock size={14} />
        </button>
        <button
          onClick={() => onTransition(a.action_id, 'dismissed')}
          title="Dismiss"
          className="p-1.5 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default function TodayContent() {
  const [view, setView] = useState<TodayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getToday();
      setView(v);
      setHasLoaded(true);
    } catch (e) {
      console.error('Today load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTransition = useCallback(
    async (id: string, status: string) => {
      // Optimistic: drop the row immediately.
      setView((prev) =>
        prev ? { ...prev, queue: prev.queue.filter((a) => a.action_id !== id), queue_total: prev.queue_total - 1 } : prev
      );
      try {
        const snoozeDays = status === 'snoozed' ? 7 : undefined;
        const snoozed_until = snoozeDays
          ? new Date(Date.now() + snoozeDays * 86400000).toISOString().slice(0, 10)
          : undefined;
        await transitionAction(id, { status, snoozed_until });
      } catch (e) {
        console.error('Action transition failed:', e);
        load(); // reconcile on failure
      }
    },
    [load]
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen p-6 pt-16 lg:pt-10 lg:p-10 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Today</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
            })()}
            , Cindy
          </h1>
          <p className="text-text-secondary text-sm mt-1.5">{today}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2 hover:border-accent/40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Outcome cards */}
      {loading && !hasLoaded ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-surface border border-border rounded-xl" />
          ))}
        </div>
      ) : view ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {Object.entries(view.outcomes).map(([k, o]) => (
            <OutcomeCard key={k} o={o} />
          ))}
        </div>
      ) : null}

      {/* Exception queue */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          What needs you {view ? `· ${view.queue_total}` : ''}
        </p>
      </div>

      {loading && !hasLoaded ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-surface border border-border rounded-lg" />
          ))}
        </div>
      ) : view && view.queue.length > 0 ? (
        <div className="space-y-2">
          {view.queue.map((a) => (
            <QueueRow key={a.action_id} a={a} onTransition={handleTransition} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck size={28} className="text-accent mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">All clear</p>
          <p className="text-xs text-text-muted">Nothing needs your attention right now.</p>
        </div>
      )}
    </div>
  );
}
