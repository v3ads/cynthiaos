'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { RefreshCw, TrendingDown, TrendingUp, Users, FileText, Key, ArrowDown, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStage {
  stage: string;
  count: number;
  conversion_from_prev: number | null;   // % that converted from previous stage
  drop_off_from_prev: number | null;     // % that dropped off from previous stage
  conversion_from_leads: number | null;  // % relative to total leads
}

interface FunnelPeriod {
  period: string;           // e.g. "2026-01" or "2026-W14"
  period_label: string;     // e.g. "Jan 2026"
  leads: number;
  applications: number;
  leases: number;
  lead_to_app_pct: number;
  app_to_lease_pct: number;
  lead_to_lease_pct: number;
}

interface FunnelSummary {
  total_leads: number;
  total_applications: number;
  total_leases: number;
  lead_to_lease_pct: number;
  lead_to_app_pct: number;
  app_to_lease_pct: number;
  period_from: string;
  period_to: string;
}

interface LeasingFunnelResponse {
  success: boolean;
  summary: FunnelSummary;
  funnel: FunnelStage[];
  trend: FunnelPeriod[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = 'https://cynthiaos-api-production.up.railway.app';

// CynthiaOS theme colors (CSS variables resolve in component, use literals for Recharts)
const CHART_COLORS = {
  leads:        '#2dd4a0',   // accent/teal
  applications: '#f59e0b',   // amber/warning
  leases:       '#60a5fa',   // blue
  grid:         'rgba(255,255,255,0.06)',
  axis:         'rgba(255,255,255,0.35)',
};

// Date range options
const DATE_RANGES = [
  { label: '30 days',  days: 30  },
  { label: '90 days',  days: 90  },
  { label: '6 months', days: 180 },
  { label: '1 year',   days: 365 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

function conversionColor(pct: number): string {
  if (pct >= 60) return 'text-success';
  if (pct >= 30) return 'text-warning';
  return 'text-danger';
}

function fromDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ─── Custom Tooltip for charts ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
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

// ─── Funnel Visual Component ──────────────────────────────────────────────────

function FunnelVisual({ funnel }: { funnel: FunnelStage[] }) {
  const max = Math.max(...funnel.map(s => s.count), 1);

  const stageConfig = [
    { icon: Users,    color: 'bg-accent',         glow: 'shadow-accent/20',    text: 'text-accent'   },
    { icon: FileText, color: 'bg-warning',         glow: 'shadow-warning/20',   text: 'text-warning'  },
    { icon: Key,      color: 'bg-blue-400',        glow: 'shadow-blue-400/20',  text: 'text-blue-400' },
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {funnel.map((stage, idx) => {
        const cfg = stageConfig[idx] ?? stageConfig[0];
        const widthPct = Math.max(30, (stage.count / max) * 100);
        const Icon = cfg.icon;

        return (
          <React.Fragment key={stage.stage}>
            {/* Drop-off connector */}
            {idx > 0 && stage.drop_off_from_prev !== null && (
              <div className="flex items-center gap-3 my-1 w-full px-4">
                <div className="flex-1 border-t border-dashed border-border/40" />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <ArrowDown size={13} className={conversionColor(stage.conversion_from_prev ?? 0)} />
                  <div className="text-center">
                    <p className={`text-xs font-bold tabular-nums ${conversionColor(stage.conversion_from_prev ?? 0)}`}>
                      {fmtPct(stage.conversion_from_prev)} converted
                    </p>
                    <p className="text-xs text-text-muted tabular-nums">
                      {fmtPct(stage.drop_off_from_prev)} dropped
                    </p>
                  </div>
                </div>
                <div className="flex-1 border-t border-dashed border-border/40" />
              </div>
            )}

            {/* Stage bar */}
            <div
              className="flex items-center gap-4 py-4 px-5 rounded-xl border border-border/40 bg-surface transition-all"
              style={{ width: `${widthPct}%`, minWidth: '60%' }}
            >
              <div className={`w-9 h-9 rounded-lg ${cfg.color}/15 flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={cfg.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5">{stage.stage}</p>
                <p className={`text-2xl font-bold tabular-nums ${cfg.text}`}>{stage.count.toLocaleString()}</p>
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
    </div>
  );
}

// ─── Pending state ─────────────────────────────────────────────────────────────

function PendingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Clock size={24} className="text-accent" />
      </div>
      <h2 className="text-base font-semibold text-text-primary mb-2">Endpoint Not Yet Available</h2>
      <p className="text-sm text-text-muted leading-relaxed mb-4">
        The <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded font-mono">/api/v1/insights/leasing-funnel</code> endpoint
        is pending backend implementation. The Bronze layer already contains <strong className="text-text-secondary">170 guest cards</strong>,
        <strong className="text-text-secondary"> 7 rental applications</strong>, and
        <strong className="text-text-secondary"> 34 lease history</strong> records — the Gold promotion and API route need to be built.
      </p>
      <div className="w-full bg-surface border border-border/40 rounded-xl p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Expected Response Shape</p>
        <pre className="text-xs text-text-secondary font-mono leading-relaxed overflow-x-auto">{`{
  "success": true,
  "summary": {
    "total_leads": 170,
    "total_applications": 7,
    "total_leases": 34,
    "lead_to_lease_pct": 20,
    "lead_to_app_pct": 4,
    "app_to_lease_pct": 50,
    "period_from": "2026-01-09",
    "period_to": "2026-04-08"
  },
  "funnel": [
    { "stage": "Leads", "count": 170,
      "conversion_from_prev": null,
      "drop_off_from_prev": null,
      "conversion_from_leads": 100 },
    { "stage": "Applications", "count": 7,
      "conversion_from_prev": 4,
      "drop_off_from_prev": 96,
      "conversion_from_leads": 4 },
    { "stage": "Leases", "count": 34,
      "conversion_from_prev": 50,
      "drop_off_from_prev": 50,
      "conversion_from_leads": 20 }
  ],
  "trend": [
    { "period": "2026-01", "period_label": "Jan 2026",
      "leads": 45, "applications": 2, "leases": 9,
      "lead_to_app_pct": 4, "app_to_lease_pct": 50,
      "lead_to_lease_pct": 20 }
  ]
}`}</pre>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeasingFunnelContent() {
  const [data, setData]           = useState<LeasingFunnelResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [rangeDays, setRangeDays] = useState(90);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [lastRefresh, setLastRefresh] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setEndpointMissing(false);
    try {
      const from = fromDate(rangeDays);
      const to   = new Date().toISOString().split('T')[0];
      const res  = await fetch(
        `${API_BASE}/api/v1/insights/leasing-funnel?from=${from}&to=${to}`,
        { cache: 'no-store' }
      );
      if (res.status === 404) {
        setEndpointMissing(true);
        return;
      }
      if (!res.ok) throw new Error(`API ${res.status}`);
      setData(await res.json());
      setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setEndpointMissing(true);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary  = data?.summary;
  const funnel   = data?.funnel   ?? [];
  const trend    = data?.trend    ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-7">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1.5">Leasing</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Leasing Funnel</h1>
          <p className="text-text-muted text-sm mt-1.5">Lead → Application → Lease conversion</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1">
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
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2 rounded-lg bg-surface border border-border/50 text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Endpoint missing state */}
      {loading && (
        <div className="space-y-4">
          {/* Skeleton summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-border/50 rounded-xl p-5 animate-pulse">
                <div className="h-3 w-16 bg-surface-elevated rounded mb-3" />
                <div className="h-8 w-20 bg-surface-elevated rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-surface border border-border/40 rounded-xl h-72 animate-pulse" />
            <div className="bg-surface border border-border/40 rounded-xl h-72 animate-pulse" />
          </div>
        </div>
      )}

      {!loading && endpointMissing && <PendingState />}

      {!loading && !endpointMissing && data && (
        <>
          {/* ── Summary Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
            {[
              {
                label: 'Total Leads',
                value: summary?.total_leads ?? 0,
                icon: Users,
                iconCls: 'bg-accent/15 text-accent',
                valueCls: 'text-text-primary',
                sub: 'Guest cards received',
              },
              {
                label: 'Applications',
                value: summary?.total_applications ?? 0,
                icon: FileText,
                iconCls: 'bg-warning/15 text-warning',
                valueCls: 'text-text-primary',
                sub: 'Rental applications submitted',
              },
              {
                label: 'Leases Signed',
                value: summary?.total_leases ?? 0,
                icon: Key,
                iconCls: 'bg-blue-400/15 text-blue-400',
                valueCls: 'text-text-primary',
                sub: 'New leases executed',
              },
              {
                label: 'Lead → Lease',
                value: fmtPct(summary?.lead_to_lease_pct ?? null),
                icon: TrendingUp,
                iconCls: (summary?.lead_to_lease_pct ?? 0) >= 15 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
                valueCls: conversionColor(summary?.lead_to_lease_pct ?? 0),
                sub: 'Overall conversion rate',
              },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-surface border border-border/50 rounded-xl p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconCls}`}>
                      <Icon size={15} />
                    </div>
                    <p className="text-xs text-text-muted">{card.label}</p>
                  </div>
                  <p className={`text-3xl font-bold tabular-nums ${card.valueCls}`}>{card.value}</p>
                  <p className="text-xs text-text-muted mt-1.5">{card.sub}</p>
                </div>
              );
            })}
          </div>

          {/* ── Funnel + Stage Metrics ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">

            {/* Funnel visual */}
            <div className="bg-surface border border-border/40 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                  <TrendingDown size={14} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Conversion Funnel</h2>
                  <p className="text-xs text-text-muted">Stage-by-stage drop-off</p>
                </div>
              </div>
              {funnel.length > 0 ? <FunnelVisual funnel={funnel} /> : (
                <p className="text-sm text-text-muted text-center py-12">No funnel data available.</p>
              )}
            </div>

            {/* Stage metrics table */}
            <div className="bg-surface border border-border/40 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center">
                  <TrendingUp size={14} className="text-text-muted" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Stage Metrics</h2>
                  <p className="text-xs text-text-muted">Conversion rates between stages</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Lead → App */}
                <div className="px-4 py-3.5 rounded-xl bg-surface-elevated border border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-text-secondary">Lead → Application</p>
                    <p className={`text-lg font-bold tabular-nums ${conversionColor(summary?.lead_to_app_pct ?? 0)}`}>
                      {fmtPct(summary?.lead_to_app_pct ?? null)}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${(summary?.lead_to_app_pct ?? 0) >= 30 ? 'bg-success' : (summary?.lead_to_app_pct ?? 0) >= 15 ? 'bg-warning' : 'bg-danger'}`}
                      style={{ width: `${Math.min(summary?.lead_to_app_pct ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    {summary?.total_applications} of {summary?.total_leads} leads became applications
                  </p>
                </div>

                {/* App → Lease */}
                <div className="px-4 py-3.5 rounded-xl bg-surface-elevated border border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-text-secondary">Application → Lease</p>
                    <p className={`text-lg font-bold tabular-nums ${conversionColor(summary?.app_to_lease_pct ?? 0)}`}>
                      {fmtPct(summary?.app_to_lease_pct ?? null)}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${(summary?.app_to_lease_pct ?? 0) >= 60 ? 'bg-success' : (summary?.app_to_lease_pct ?? 0) >= 30 ? 'bg-warning' : 'bg-danger'}`}
                      style={{ width: `${Math.min(summary?.app_to_lease_pct ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    {summary?.total_leases} of {summary?.total_applications} applications became leases
                  </p>
                </div>

                {/* Lead → Lease */}
                <div className="px-4 py-3.5 rounded-xl bg-surface-elevated border border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-text-secondary">Lead → Lease (overall)</p>
                    <p className={`text-lg font-bold tabular-nums ${conversionColor(summary?.lead_to_lease_pct ?? 0)}`}>
                      {fmtPct(summary?.lead_to_lease_pct ?? null)}
                    </p>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${(summary?.lead_to_lease_pct ?? 0) >= 15 ? 'bg-success' : (summary?.lead_to_lease_pct ?? 0) >= 8 ? 'bg-warning' : 'bg-danger'}`}
                      style={{ width: `${Math.min((summary?.lead_to_lease_pct ?? 0) * 5, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-1.5">
                    End-to-end funnel efficiency
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Trend Chart ─────────────────────────────────────────────── */}
          <div className="bg-surface border border-border/40 rounded-xl p-6 mb-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center">
                  <TrendingUp size={14} className="text-text-muted" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Volume Trend</h2>
                  <p className="text-xs text-text-muted">Leads, applications, and leases over time</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-surface-elevated border border-border/40 rounded-lg p-1">
                {(['bar', 'line'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                      chartType === t ? 'bg-surface text-text-primary font-medium' : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {trend.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-sm text-text-muted">No trend data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                {chartType === 'bar' ? (
                  <BarChart data={trend} margin={{ top: 4, right: 12, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="period_label" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="leads"        name="Leads"        fill={CHART_COLORS.leads}        radius={[3,3,0,0]} />
                    <Bar dataKey="applications" name="Applications" fill={CHART_COLORS.applications} radius={[3,3,0,0]} />
                    <Bar dataKey="leases"       name="Leases"       fill={CHART_COLORS.leases}       radius={[3,3,0,0]} />
                  </BarChart>
                ) : (
                  <LineChart data={trend} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="period_label" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
                    <Line dataKey="leads"        name="Leads"        stroke={CHART_COLORS.leads}        strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line dataKey="applications" name="Applications" stroke={CHART_COLORS.applications} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line dataKey="leases"       name="Leases"       stroke={CHART_COLORS.leases}       strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Period Table ─────────────────────────────────────────────── */}
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold text-text-primary">Period Breakdown</h2>
              <p className="text-xs text-text-muted mt-0.5">Conversion rates by period</p>
            </div>
            {trend.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-10">No period data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      {['Period', 'Leads', 'Applications', 'Leases', 'Lead→App', 'App→Lease', 'Lead→Lease'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {trend.map(row => (
                      <tr key={row.period} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-4 py-3 text-xs font-medium text-text-primary">{row.period_label}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-accent font-semibold">{row.leads}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-warning">{row.applications}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-blue-400">{row.leases}</td>
                        <td className="px-4 py-3 text-xs tabular-nums">
                          <span className={conversionColor(row.lead_to_app_pct)}>{fmtPct(row.lead_to_app_pct)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums">
                          <span className={conversionColor(row.app_to_lease_pct)}>{fmtPct(row.app_to_lease_pct)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums">
                          <span className={conversionColor(row.lead_to_lease_pct)}>{fmtPct(row.lead_to_lease_pct)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {lastRefresh && (
            <p className="text-xs text-text-muted mt-4 text-right">Refreshed at {lastRefresh}</p>
          )}
        </>
      )}
    </div>
  );
}
