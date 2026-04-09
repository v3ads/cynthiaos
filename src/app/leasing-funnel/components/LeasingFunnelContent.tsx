'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw, Users, FileText, Key, ArrowDown, TrendingDown, TrendingUp,
} from 'lucide-react';
import {
  getLeasingFunnel,
  LeasingFunnelResponse,
  LeasingFunnelStage,
  LeasingFunnelPeriod,
  LeasingFunnelSummary,
} from '@/lib/api';
import { toast } from 'sonner';

// ─── Config ───────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  leads:        '#2dd4a0',
  applications: '#f59e0b',
  leases:       '#60a5fa',
  grid:         'rgba(255,255,255,0.06)',
  axis:         'rgba(255,255,255,0.35)',
};

const DATE_RANGES: { label: string; days: number }[] = [
  { label: '30d',  days: 30  },
  { label: '90d',  days: 90  },
  { label: '6mo',  days: 180 },
  { label: '1yr',  days: 365 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function toDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function fmtPct(n: number | null, allowOver100 = false): string {
  if (n === null || n === undefined) return '—';
  // App→Lease can legitimately exceed 100% — show as-is with note
  if (!allowOver100 && n > 100) return `${n}%*`;
  return `${Math.round(n)}%`;
}

function conversionColor(pct: number): string {
  if (pct <= 0)  return 'text-text-muted';
  if (pct >= 50) return 'text-success';
  if (pct >= 20) return 'text-warning';
  return 'text-danger';
}

function conversionBarColor(pct: number): string {
  if (pct >= 50) return 'bg-success';
  if (pct >= 20) return 'bg-warning';
  return 'bg-danger';
}

// ─── Custom Recharts tooltip ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-border/60 rounded-lg px-3 py-2.5 shadow-xl text-xs">
      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-text-secondary capitalize">{p.name}:</span>
          <span className="font-semibold text-text-primary tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel Visual ────────────────────────────────────────────────────────────

const STAGE_CONFIG = [
  { icon: Users,    textCls: 'text-accent',   bgCls: 'bg-accent/15'    },
  { icon: FileText, textCls: 'text-warning',  bgCls: 'bg-warning/15'   },
  { icon: Key,      textCls: 'text-blue-400', bgCls: 'bg-blue-400/15'  },
];

function FunnelVisual({ stages }: { stages: LeasingFunnelStage[] }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="flex flex-col items-center w-full">
      {stages.map((stage, idx) => {
        const cfg   = STAGE_CONFIG[idx] ?? STAGE_CONFIG[0];
        const Icon  = cfg.icon;
        const widthPct = Math.max(35, (stage.count / maxCount) * 100);
        const convPrev = stage.conversion_from_prev;
        const dropPrev = stage.drop_off_from_prev;

        // App→Lease > 100 is a known data quirk — lease_history includes
        // renewals and offline leases that skip the formal application stage
        const isOverflow = convPrev !== null && convPrev > 100;

        return (
          <React.Fragment key={stage.stage}>
            {/* Connector between stages */}
            {idx > 0 && (
              <div className="flex items-center justify-center w-full py-1.5">
                <div className="flex flex-col items-center gap-0.5">
                  <ArrowDown
                    size={14}
                    className={isOverflow ? 'text-text-muted' : conversionColor(convPrev ?? 0)}
                  />
                  {convPrev !== null && (
                    <div className="text-center">
                      <p className={`text-xs font-bold tabular-nums leading-tight ${
                        isOverflow ? 'text-text-muted' : conversionColor(convPrev)
                      }`}>
                        {isOverflow ? '—*' : `${Math.round(convPrev)}% converted`}
                      </p>
                      {dropPrev !== null && !isOverflow && (
                        <p className="text-xs text-text-muted tabular-nums leading-tight">
                          {Math.round(dropPrev)}% dropped off
                        </p>
                      )}
                      {isOverflow && (
                        <p className="text-xs text-text-muted leading-tight">offline leases*</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stage bar */}
            <div
              className="flex items-center gap-3 py-4 px-5 rounded-xl border border-border/40 bg-surface transition-all"
              style={{ width: `${widthPct}%`, minWidth: '55%' }}
            >
              <div className={`w-9 h-9 rounded-lg ${cfg.bgCls} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={cfg.textCls} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5">
                  {stage.stage}
                </p>
                <p className={`text-2xl font-bold tabular-nums ${cfg.textCls}`}>
                  {stage.count.toLocaleString()}
                </p>
              </div>
              {stage.conversion_from_leads !== null && idx > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-text-muted">of leads</p>
                  <p className={`text-sm font-semibold tabular-nums ${conversionColor(stage.conversion_from_leads)}`}>
                    {fmtPct(stage.conversion_from_leads)}
                  </p>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* Data quirk footnote */}
      {stages.some(s => (s.conversion_from_prev ?? 0) > 100) && (
        <p className="text-xs text-text-muted mt-4 text-center max-w-xs leading-relaxed">
          * Leases exceed applications because <code className="font-mono">lease_history</code> includes
          renewals and offline leases that bypass the formal application stage.
        </p>
      )}
    </div>
  );
}

// ─── Conversion Rate Bar ──────────────────────────────────────────────────────

function ConversionBar({
  label, pct, from, to, note,
}: {
  label: string;
  pct: number;
  from: string;
  to: string;
  note?: string;
}) {
  const isOverflow = pct > 100;
  const displayPct = isOverflow ? 100 : Math.min(pct, 100);

  return (
    <div className="px-4 py-3.5 rounded-xl bg-surface-elevated border border-border/40">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${isOverflow ? 'text-text-muted' : conversionColor(pct)}`}>
          {isOverflow ? '—*' : fmtPct(pct)}
        </p>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverflow ? 'bg-text-muted/30' : conversionBarColor(pct)
          }`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
      <p className="text-xs text-text-muted mt-1.5">
        {note ?? `${from} → ${to}`}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeasingFunnelContent() {
  const [data, setData]           = useState<LeasingFunnelResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [rangeDays, setRangeDays] = useState(90);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const load = useCallback(async (isRefresh = false) => {
    setLoading(true);
    try {
      const from = fromDateStr(rangeDays);
      const to   = toDateStr();
      const res  = await getLeasingFunnel(from, to);
      setData(res);
      if (isRefresh) toast.success('Funnel data refreshed.');
    } catch {
      toast.error('Failed to load leasing funnel data.');
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => { load(); }, [load]);

  const s       = data?.summary;
  const funnel  = data?.funnel  ?? [];
  const trend   = data?.trend   ?? [];
  const hasOverflow = funnel.some(f => (f.conversion_from_prev ?? 0) > 100);

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-7">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1.5">Leasing</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Leasing Funnel</h1>
          <p className="text-text-muted text-sm mt-1.5">Lead → Application → Lease conversion</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-0.5 bg-surface border border-border/50 rounded-lg p-1">
            {DATE_RANGES.map(r => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  rangeDays === r.days
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="p-2 rounded-lg bg-surface border border-border/50 text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border/50 rounded-xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-surface-elevated rounded mb-4" />
              <div className="h-9 w-16 bg-surface-elevated rounded mb-2" />
              <div className="h-2.5 w-28 bg-surface-elevated rounded" />
            </div>
          ))
        ) : (
          [
            {
              label: 'Total Leads',
              value: s?.total_leads ?? 0,
              icon: Users,
              iconCls: 'bg-accent/15 text-accent',
              valueCls: 'text-text-primary',
              sub: 'Guest cards received',
            },
            {
              label: 'Applications',
              value: s?.total_applications ?? 0,
              icon: FileText,
              iconCls: 'bg-warning/15 text-warning',
              valueCls: 'text-text-primary',
              sub: 'Formal rental applications',
            },
            {
              label: 'Leases Signed',
              value: s?.total_leases ?? 0,
              icon: Key,
              iconCls: 'bg-blue-400/15 text-blue-400',
              valueCls: 'text-text-primary',
              sub: 'New leases executed',
            },
            {
              label: 'Lead → Lease',
              value: s ? `${s.lead_to_lease_pct}%` : '—',
              icon: TrendingUp,
              iconCls: (s?.lead_to_lease_pct ?? 0) >= 10
                ? 'bg-success/15 text-success'
                : 'bg-danger/15 text-danger',
              valueCls: conversionColor(s?.lead_to_lease_pct ?? 0),
              sub: 'Overall funnel efficiency',
            },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-surface border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconCls}`}>
                    <Icon size={14} />
                  </div>
                  <p className="text-xs text-text-muted">{card.label}</p>
                </div>
                <p className={`text-3xl font-bold tabular-nums ${card.valueCls}`}>{card.value}</p>
                <p className="text-xs text-text-muted mt-1.5">{card.sub}</p>
              </div>
            );
          })
        )}
      </div>

      {/* ── Funnel + Metrics ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">

        {/* Funnel visual */}
        <div className="bg-surface border border-border/40 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <TrendingDown size={14} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Conversion Funnel</h2>
              <p className="text-xs text-text-muted">Stage-by-stage drop-off view</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-4">
              {[100, 65, 45].map((w, i) => (
                <div key={i} className="h-16 animate-pulse bg-surface-elevated rounded-xl" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : funnel.length > 0 ? (
            <FunnelVisual stages={funnel} />
          ) : (
            <p className="text-sm text-text-muted text-center py-12">No funnel data for this period.</p>
          )}
        </div>

        {/* Stage metrics */}
        <div className="bg-surface border border-border/40 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center">
              <TrendingUp size={14} className="text-text-muted" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Stage Conversion Rates</h2>
              <p className="text-xs text-text-muted">How efficiently each stage converts</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse bg-surface-elevated rounded-xl" />
              ))}
            </div>
          ) : s ? (
            <div className="space-y-3">
              <ConversionBar
                label="Lead → Application"
                pct={s.lead_to_app_pct}
                from={`${s.total_applications} applications`}
                to={`from ${s.total_leads} leads`}
              />
              <ConversionBar
                label="Application → Lease"
                pct={s.app_to_lease_pct}
                from={`${s.total_leases} leases`}
                to={`from ${s.total_applications} applications`}
                note={
                  s.app_to_lease_pct > 100
                    ? '* Includes renewals & offline leases not tracked as applications'
                    : `${s.total_leases} of ${s.total_applications} applications converted`
                }
              />
              <ConversionBar
                label="Lead → Lease (overall)"
                pct={s.lead_to_lease_pct}
                from={`${s.total_leases} leases`}
                to={`from ${s.total_leads} leads`}
                note="End-to-end funnel efficiency"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Trend Chart ──────────────────────────────────────────── */}
      <div className="bg-surface border border-border/40 rounded-xl p-6 mb-7">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center">
              <TrendingUp size={14} className="text-text-muted" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Volume Trend</h2>
              <p className="text-xs text-text-muted">Leads, applications, and leases by month</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 bg-surface-elevated border border-border/40 rounded-lg p-1">
            {(['bar', 'line'] as const).map(t => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                  chartType === t
                    ? 'bg-surface text-text-primary font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-56 animate-pulse bg-surface-elevated rounded-lg" />
        ) : trend.length === 0 ? (
          <div className="flex items-center justify-center h-56 text-sm text-text-muted">
            No trend data for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            {chartType === 'bar' ? (
              <BarChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="period_label" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} iconType="circle" iconSize={8} />
                <Bar dataKey="leads"        name="Leads"        fill={CHART_COLORS.leads}        radius={[3,3,0,0]} />
                <Bar dataKey="applications" name="Applications" fill={CHART_COLORS.applications} radius={[3,3,0,0]} />
                <Bar dataKey="leases"       name="Leases"       fill={CHART_COLORS.leases}       radius={[3,3,0,0]} />
              </BarChart>
            ) : (
              <LineChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="period_label" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} iconType="circle" iconSize={8} />
                <Line dataKey="leads"        name="Leads"        stroke={CHART_COLORS.leads}        strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.leads }}        activeDot={{ r: 5 }} />
                <Line dataKey="applications" name="Applications" stroke={CHART_COLORS.applications} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.applications }} activeDot={{ r: 5 }} />
                <Line dataKey="leases"       name="Leases"       stroke={CHART_COLORS.leases}       strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.leases }}       activeDot={{ r: 5 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Period Table ──────────────────────────────────────────── */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Period Breakdown</h2>
            <p className="text-xs text-text-muted mt-0.5">Monthly conversion rates</p>
          </div>
          {hasOverflow && (
            <p className="text-xs text-text-muted max-w-xs text-right">
              * App→Lease {'>'}100% = offline leases included in lease_history
            </p>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-border/30">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-4 px-5 py-3 animate-pulse">
                {[...Array(7)].map((_, j) => (
                  <div key={j} className="h-4 bg-surface-elevated rounded" />
                ))}
              </div>
            ))}
          </div>
        ) : trend.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            No period data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  {['Period', 'Leads', 'Applications', 'Leases', 'Lead→App', 'App→Lease', 'Lead→Lease'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {trend.map(row => (
                  <tr key={row.period} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="px-5 py-3 text-xs font-medium text-text-primary whitespace-nowrap">
                      {row.period_label}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums font-semibold text-accent">
                      {row.leads.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums text-warning">
                      {row.applications}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums text-blue-400">
                      {row.leases}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums">
                      <span className={conversionColor(row.lead_to_app_pct)}>
                        {fmtPct(row.lead_to_app_pct)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums">
                      <span className={row.app_to_lease_pct > 100 ? 'text-text-muted' : conversionColor(row.app_to_lease_pct)}>
                        {row.app_to_lease_pct > 100 ? `${row.app_to_lease_pct}%*` : fmtPct(row.app_to_lease_pct)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums">
                      <span className={conversionColor(row.lead_to_lease_pct)}>
                        {fmtPct(row.lead_to_lease_pct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
