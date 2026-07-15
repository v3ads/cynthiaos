'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Info, ArrowUpRight, ShieldCheck, AlertTriangle, Ban } from 'lucide-react';
import {
  MetricContract,
  MetricConfidence,
  RATE_METRIC_IDS,
  CURRENCY_METRIC_IDS,
} from '@/lib/api';

// Renders one management metric in the standard contract shape: value,
// confidence, a definition popover, denominator context, and a drilldown.
// Confidence is data (from the metric contract), NOT a transport error —
// a blocked/warning card is the product working as designed and appears on
// every surface (per the July 15 decision register, item 4).

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtInt = (v: number) => new Intl.NumberFormat('en-US').format(v);

function formatValue(m: MetricContract): string {
  if (m.value == null) return '—';
  if (RATE_METRIC_IDS.has(m.metric_id)) return fmtPct(m.value);
  if (CURRENCY_METRIC_IDS.has(m.metric_id)) return fmtCurrency(m.value);
  return fmtInt(m.value);
}

const CONFIDENCE: Record<
  MetricConfidence,
  { label: string; badge: string; icon: React.ElementType; value: string }
> = {
  trusted: {
    label: 'Trusted',
    badge: 'bg-accent/10 text-accent border-accent/25',
    icon: ShieldCheck,
    value: 'text-text-primary',
  },
  warning: {
    label: 'Check failing',
    badge: 'bg-warning/10 text-warning border-warning/30',
    icon: AlertTriangle,
    value: 'text-text-primary',
  },
  blocked: {
    label: 'Not available',
    badge: 'bg-danger/10 text-danger border-danger/30',
    icon: Ban,
    value: 'text-text-muted',
  },
};

export default function MetricCard({ metric }: { metric: MetricContract }) {
  const [showDef, setShowDef] = useState(false);
  const conf = CONFIDENCE[metric.confidence];
  const ConfIcon = conf.icon;
  const isBlocked = metric.confidence === 'blocked';

  return (
    <div className="relative bg-surface border border-border/50 rounded-xl p-4 sm:p-5 flex flex-col">
      {/* Header: label + confidence badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs text-text-secondary leading-tight truncate">{metric.label}</p>
          <button
            type="button"
            onClick={() => setShowDef((s) => !s)}
            aria-label="Show definition"
            className="text-text-muted hover:text-text-secondary flex-shrink-0"
          >
            <Info size={12} />
          </button>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${conf.badge}`}
        >
          <ConfIcon size={9} />
          {conf.label}
        </span>
      </div>

      {/* Value */}
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${conf.value}`}>
        {formatValue(metric)}
      </p>

      {/* Denominator / blocked reason */}
      {isBlocked ? (
        <p className="text-[10px] text-danger/80 mt-1 leading-snug">
          Not tracked — see definition
        </p>
      ) : metric.denominator != null ? (
        <p className="text-[10px] text-text-muted mt-1">
          of {fmtInt(metric.denominator)}
          {metric.denominator_definition ? ` ${metric.denominator_definition.toLowerCase()}` : ''}
        </p>
      ) : null}

      {/* Footer: drilldown */}
      <div className="mt-auto pt-3">
        <Link
          href={metric.drilldown_url}
          className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
        >
          View detail
          <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Definition popover */}
      {showDef && (
        <div
          className="absolute z-20 top-9 left-3 right-3 bg-surface-elevated border border-border rounded-lg p-3 shadow-lg"
          onMouseLeave={() => setShowDef(false)}
        >
          <p className="text-[11px] font-semibold text-text-primary mb-1">{metric.label}</p>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {metric.population_definition}
          </p>
          {metric.affected_checks.length > 0 && (
            <p className="text-[10px] text-warning mt-2 leading-snug">
              Affected by: {metric.affected_checks.join(', ')}
            </p>
          )}
          {metric.source_freshness && (
            <p className="text-[10px] text-text-muted mt-2">
              Data as of {new Date(metric.source_freshness).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
