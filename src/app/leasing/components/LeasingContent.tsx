'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowUpRight, AlertTriangle, Users, FileText } from 'lucide-react';
import { getLeasing, LeasingView } from '@/lib/api';

function QueueCard({
  label,
  value,
  urgent,
  href,
  urgentLabel,
}: {
  label: string;
  value: number;
  urgent?: number;
  href?: string;
  urgentLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-text-secondary leading-tight">{label}</p>
        {urgent ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/25">
            <AlertTriangle size={9} /> {urgent} {urgentLabel ?? 'urgent'}
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold tabular-nums text-text-primary">{value}</p>
      {href && (
        <span className="mt-auto pt-3 inline-flex items-center gap-0.5 text-[11px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View list <ArrowUpRight size={11} />
        </span>
      )}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="group bg-surface border border-border/50 rounded-xl p-4 sm:p-5 flex flex-col hover:border-accent/40 transition-colors"
    >
      {body}
    </Link>
  ) : (
    <div className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5 flex flex-col">{body}</div>
  );
}

function CohortRow({
  label,
  value,
  note,
  extra,
}: {
  label: string;
  value: number;
  note?: string;
  extra?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-text-primary">{label}</p>
        {note && <p className="text-[11px] text-text-muted mt-0.5">{note}</p>}
      </div>
      <div className="text-right flex-shrink-0 pl-3">
        <p className="text-lg font-bold tabular-nums text-text-primary">{value}</p>
        {extra && <p className="text-[10px] text-text-muted">{extra}</p>}
      </div>
    </div>
  );
}

export default function LeasingContent() {
  const [view, setView] = useState<LeasingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getLeasing();
      setView(v);
      setHasLoaded(true);
    } catch (e) {
      console.error('Leasing load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cohort = (key: string) => {
    const c = view?.prospect_cohorts?.[key];
    return typeof c === 'object' ? c : null;
  };

  return (
    <div className="min-h-screen p-6 pt-16 lg:pt-10 lg:p-10 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Leasing</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Leasing</h1>
          <p className="text-text-secondary text-sm mt-1.5">
            Lease decisions and the prospect pipeline
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2 hover:border-accent/40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Lease decision queues */}
      <div className="flex items-center gap-2 mb-4">
        <FileText size={14} className="text-accent" />
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Lease decisions</p>
      </div>
      {loading && !hasLoaded ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-surface border border-border rounded-xl" />
          ))}
        </div>
      ) : view ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <QueueCard
            label={view.lease_queues.renewals_due.label}
            value={view.lease_queues.renewals_due.value}
            urgent={view.lease_queues.renewals_due.urgent}
            urgentLabel="≤30d"
            href="/lease-expirations"
          />
          <QueueCard
            label={view.lease_queues.holdovers.label}
            value={view.lease_queues.holdovers.value}
            href="/lease-expirations"
          />
          <QueueCard
            label={view.lease_queues.stale_closeouts.label}
            value={view.lease_queues.stale_closeouts.value}
            href="/lease-expirations"
          />
          <QueueCard
            label={view.lease_queues.scheduled_moveouts.label}
            value={view.lease_queues.scheduled_moveouts.value}
            href="/unit-turns"
          />
        </div>
      ) : null}

      {/* Prospect pipeline */}
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} className="text-accent" />
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Prospect pipeline {view ? `· ${view.prospect_cohorts.total} total` : ''}
        </p>
      </div>
      {loading && !hasLoaded ? (
        <div className="h-64 animate-pulse bg-surface border border-border rounded-xl" />
      ) : view ? (
        <div className="bg-surface border border-border/50 rounded-xl p-5 max-w-2xl">
          {cohort('fresh_engaged') && (
            <CohortRow
              label={cohort('fresh_engaged')!.label}
              value={cohort('fresh_engaged')!.value}
              note={cohort('fresh_engaged')!.note}
            />
          )}
          {cohort('follow_up_due') && (
            <CohortRow
              label={cohort('follow_up_due')!.label}
              value={cohort('follow_up_due')!.value}
              note={cohort('follow_up_due')!.note}
            />
          )}
          {cohort('qualified') && (
            <CohortRow
              label={cohort('qualified')!.label}
              value={cohort('qualified')!.value}
              note={cohort('qualified')!.note}
            />
          )}
          {cohort('future_movein') && (
            <CohortRow
              label={cohort('future_movein')!.label}
              value={cohort('future_movein')!.value}
              note={cohort('future_movein')!.note}
            />
          )}
          {cohort('stale') && (
            <CohortRow
              label={cohort('stale')!.label}
              value={cohort('stale')!.value}
              note={cohort('stale')!.note}
              extra={
                cohort('stale')!.sub_auto_only
                  ? `${cohort('stale')!.sub_auto_only} auto-only`
                  : undefined
              }
            />
          )}
          <div className="mt-4 pt-3 border-t border-border/40">
            <Link
              href="/leasing-pipeline"
              className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
            >
              Open full prospect pipeline <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
