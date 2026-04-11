'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  getPortfolioHealth, getAtRiskRevenue, getCollectionsRisk,
  getLeaseExpirationRisk, getTurnoverVelocity, getIncomeStatements, getExpiringCount,
  PortfolioHealth, AtRiskTenant, CollectionsRiskTenant,
  LeaseExpirationRiskItem, TurnoverVelocityResponse, IncomeStatement,
} from '@/lib/api';
import { Activity, DollarSign, ShieldAlert, FileText, Home, RefreshCw } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n: number | null) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
function formatName(name: string): string {
  if (!name) return '—';
  if (/^[A-Z\s,.'\-]+$/.test(name) && name.includes(',')) {
    const [last, ...firstParts] = name.split(',').map((s: string) => s.trim());
    return [firstParts.join(' '), last]
      .filter(Boolean)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return name;
}
function initials(name: string) {
  const clean = formatName(name);
  return clean.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | string;

function UrgencyBadge({ level }: { level: RiskLevel }) {
  const cfg: Record<string, string> = {
    HIGH: 'bg-danger/10 text-danger border-danger/25',
    MEDIUM: 'bg-warning/10 text-warning border-warning/25',
    LOW: 'bg-accent/10 text-accent border-accent/25',
    'Immediate Action': 'bg-danger/10 text-danger border-danger/25',
    'High Priority': 'bg-warning/10 text-warning border-warning/25',
    Monitor: 'bg-surface-elevated text-text-secondary border-border/50',
    'Low Risk': 'bg-accent/10 text-accent border-accent/25',
  };
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${cfg[level] ?? 'bg-surface-elevated text-text-muted border-border/50'}`}>
      {level}
    </span>
  );
}

function BucketPill({ bucket }: { bucket: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    '0_30':    { label: '0–30d',  cls: 'text-text-muted' },
    '31_60':   { label: '31–60d', cls: 'text-warning' },
    '61_90':   { label: '61–90d', cls: 'text-danger' },
    '90_plus': { label: '90d+',   cls: 'text-danger font-semibold' },
  };
  const cfg = map[bucket] ?? { label: bucket, cls: 'text-text-muted' };
  return <span className={`text-xs tabular-nums ${cfg.cls}`}>{cfg.label}</span>;
}

function SectionHeader({ icon: Icon, title, sub, iconCls }: { icon: React.ElementType; title: string; sub: string; iconCls: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconCls}`}>
        <Icon size={16} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-muted">{sub}</p>
      </div>
    </div>
  );
}

function BreakdownBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-text-secondary">{label} <span className="text-text-muted">({weight})</span></span>
        <span className="text-xs font-semibold text-text-primary tabular-nums">{score}%</span>
      </div>
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function LoadingRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(n)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse bg-surface-elevated rounded-lg" />
      ))}
    </div>
  );
}

export default function InsightsContent() {
  const [health, setHealth]         = useState<PortfolioHealth | null>(null);
  const [atRisk, setAtRisk]         = useState<AtRiskTenant[]>([]);
  const [collections, setCollections] = useState<CollectionsRiskTenant[]>([]);
  const [expRisk, setExpRisk]       = useState<LeaseExpirationRiskItem[]>([]);
  const [turnover, setTurnover]     = useState<TurnoverVelocityResponse | null>(null);
  const [income, setIncome]         = useState<IncomeStatement | null>(null);
  const [expiring30, setExpiring30] = useState<number | null>(null);
  const [expiring90, setExpiring90] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      getPortfolioHealth(),
      getAtRiskRevenue(),
      getCollectionsRisk(),
      getLeaseExpirationRisk(),
      getTurnoverVelocity(),
      getIncomeStatements(),
      getExpiringCount(30),
      getExpiringCount(90),
    ]).then(([h, ar, col, er, tv, inc, e30, e90]) => {
      if (h.status === 'fulfilled')   setHealth(h.value);
      if (ar.status === 'fulfilled')  setAtRisk(ar.value.data);
      if (col.status === 'fulfilled') setCollections(col.value.data);
      if (er.status === 'fulfilled')  setExpRisk(er.value.data);
      if (tv.status === 'fulfilled')  setTurnover(tv.value);
      if (inc.status === 'fulfilled') setIncome(inc.value.data[0] ?? null);
      if (e30.status === 'fulfilled') setExpiring30(e30.value.total);
      if (e90.status === 'fulfilled') setExpiring90(e90.value.total);
    }).finally(() => {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const scoreColor = (s: number) => s >= 80 ? 'text-success' : s >= 60 ? 'text-warning' : 'text-danger';
  const r = 54; const circ = 2 * Math.PI * r;

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1.5">Intelligence Layer</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Insights</h1>
          <p className="text-text-muted text-sm mt-1.5">All 6 insight modules — powered by Gold layer cross-domain analysis</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {lastUpdated ? `Refreshed · ${lastUpdated}` : 'Refresh'}
        </button>
      </div>

      {/* ── 1. Portfolio Health ────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <SectionHeader icon={Activity} title="Portfolio Health" sub="Composite 0–100 score across Financial (40%), Occupancy (30%), and Risk (30%)" iconCls="bg-accent/15 text-accent" />
        {loading || !health ? (
          <div className="h-48 animate-pulse bg-surface-elevated rounded-lg" />
        ) : (!health.data_availability.occupancy_data && !health.data_availability.financial_data && !health.data_availability.risk_data) ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-text-primary mb-1">No data yet</p>
            <p className="text-xs text-text-muted">Cron runs daily at 6:00 AM Eastern. Real AppFolio data will populate after the next run.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ring */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative">
                <svg width="148" height="148" viewBox="0 0 148 148">
                  <circle cx="74" cy="74" r={r} fill="none" stroke="var(--color-background-secondary)" strokeWidth="14" />
                  <circle cx="74" cy="74" r={r} fill="none"
                    stroke={health.portfolio_health_score >= 80 ? 'var(--color-text-success)' : health.portfolio_health_score >= 60 ? 'var(--color-text-warning)' : 'var(--color-text-danger)'}
                    strokeWidth="14"
                    strokeDasharray={`${circ * (health.portfolio_health_score / 100)} ${circ}`}
                    strokeLinecap="round" transform="rotate(-90 74 74)" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-text-primary">{health.portfolio_health_score}</span>
                  <span className="text-sm text-text-muted">%</span>
                </div>
              </div>
              <p className="text-lg font-semibold text-text-primary mt-3">{health.classification}</p>
            </div>
            {/* Real metrics only — no internal scoring bars */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Portfolio Metrics</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Revenue — combined MTD + YTD card spanning both columns */}
                <div className="col-span-2 bg-surface-elevated rounded-lg px-3 py-2.5">
                  <p className="text-xs text-text-muted mb-2">Revenue</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-text-muted">MTD</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{income ? fmt$(income.total_income_mtd) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">YTD</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{income ? fmt$(income.total_income) : '—'}</p>
                    </div>
                  </div>
                </div>
                {/* Remaining metrics */}
                {[
                  { label: 'Occupancy Rate',  val: fmtPct(health.supporting_metrics.occupancy_rate),                                      cls: 'text-text-primary' },
                  { label: 'Vacancy Rate',    val: fmtPct(health.supporting_metrics.vacancy_rate),                                        cls: (health.supporting_metrics.vacancy_rate ?? 0) > 0.15 ? 'text-danger' : 'text-text-primary' },
                  { label: 'NOI YTD',         val: income ? fmt$(income.net_operating_income) : '—',                                      cls: 'text-text-primary' },
                  { label: 'Delinquency',     val: fmt$(health.supporting_metrics.total_delinquency_balance),                             cls: 'text-danger' },
                  { label: 'Expiring 30d',    val: expiring30 !== null ? String(expiring30) : '—',                                        cls: (expiring30 ?? 0) > 0 ? 'text-danger' : 'text-text-primary' },
                  { label: 'Expiring 90d',    val: expiring90 !== null ? String(expiring90) : '—',                                        cls: (expiring90 ?? 0) > 10 ? 'text-warning' : 'text-text-primary' },
                ].map(m => (
                  <div key={m.label} className="bg-surface-elevated rounded-lg px-3 py-2.5">
                    <p className="text-xs text-text-muted mb-0.5">{m.label}</p>
                    <p className={`text-sm font-semibold tabular-nums ${m.cls}`}>{m.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 2 + 3 side by side ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* At-Risk Revenue */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <SectionHeader icon={DollarSign} title="At-Risk Revenue" sub="Tenants ranked by combined debt load and lease expiration urgency" iconCls="bg-danger/15 text-danger" />
          {loading ? <LoadingRows /> : atRisk.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">No at-risk tenants detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Tenant', 'Unit', 'Balance', 'Aging', 'Risk Score', 'Urgency'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {atRisk.map(t => (
                    <tr key={t.tenant_id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-danger/10 flex items-center justify-center text-xs font-semibold text-danger flex-shrink-0">{initials(t.full_name)}</div>
                          <span className="font-medium text-text-primary text-xs">{formatName(t.full_name)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{t.unit_id}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-danger tabular-nums">{fmt$(t.total_balance)}</td>
                      <td className="px-3 py-2.5"><BucketPill bucket={t.dominant_bucket} /></td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-text-secondary">{t.risk_score.toLocaleString()}</td>
                      <td className="px-3 py-2.5"><UrgencyBadge level={t.urgency_level} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Collections Risk */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <SectionHeader icon={ShieldAlert} title="Collections Risk" sub="Tenants classified into intervention tiers by debt age and lease urgency" iconCls="bg-warning/15 text-warning" />
          {loading ? <LoadingRows /> : collections.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">No collections risk detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Tenant', 'Unit', 'Balance', '90d+', 'Col. Score', 'Classification'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {collections.map(t => (
                    <tr key={t.tenant_id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-warning/10 flex items-center justify-center text-xs font-semibold text-warning flex-shrink-0">{initials(t.full_name)}</div>
                          <span className="font-medium text-text-primary text-xs">{formatName(t.full_name)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{t.unit_id}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-danger tabular-nums">{fmt$(t.total_balance)}</td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-danger">{fmt$(t.bucket_90_plus)}</td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-text-secondary">{t.collections_risk_score}</td>
                      <td className="px-3 py-2.5"><UrgencyBadge level={t.collections_classification} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Lease Expiration Risk ──────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <SectionHeader icon={FileText} title="Lease Expiration Risk" sub="Leases ranked by likelihood of resulting in vacancy — cross-referenced with financial data" iconCls="bg-accent/15 text-accent" />
        {loading ? <LoadingRows n={5} /> : expRisk.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">No expiration risk data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {['Tenant', 'Unit', 'Lease End', 'Days Left', 'Delinquency', 'Exp. Risk'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {expRisk.map(t => (
                  <tr key={t.tenant_id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-xs font-medium text-text-secondary flex-shrink-0">{initials(t.full_name)}</div>
                        <span className="font-medium text-text-primary text-xs">{formatName(t.full_name)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{t.unit_id}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary tabular-nums">
                      {t.lease_end_date ? new Date(t.lease_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-semibold tabular-nums ${t.days_until_expiration <= 30 ? 'text-danger' : t.days_until_expiration <= 60 ? 'text-warning' : 'text-text-secondary'}`}>
                        {t.days_until_expiration}d
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-muted">{t.delinquency_level ?? '—'}</td>
                    <td className="px-3 py-2.5"><UrgencyBadge level={t.expiration_risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expRisk.length >= 10 && (
              <div className="border-t border-border/40 px-4 py-3 text-center">
                <a href="/lease-expirations" className="text-xs font-medium text-accent hover:underline">
                  View all lease expirations →
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. Turnover Velocity ──────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
              <Home size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Turnover Velocity</h2>
              <p className="text-xs text-text-muted">Unit-level churn analysis — stability score per unit (0 = High Churn, 100 = Stable)</p>
            </div>
          </div>
          {turnover && (
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <p className="text-text-muted">Portfolio stability</p>
                <p className={`text-lg font-bold tabular-nums ${scoreColor(turnover.portfolio.stability_score)}`}>{turnover.portfolio.stability_score}%</p>
              </div>
              <div className="text-right">
                <p className="text-text-muted">Classification</p>
                <p className="text-sm font-semibold text-text-primary">{turnover.portfolio.classification}</p>
              </div>
              <div className="text-right">
                <p className="text-text-muted">Avg events/unit</p>
                <p className="text-sm font-semibold text-text-primary">{turnover?.portfolio.avg_turnover_per_unit.toFixed(1)}</p>
              </div>
            </div>
          )}
        </div>
        {loading || !turnover ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-surface-elevated rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {turnover.data.map(u => {
                const sc = u.stability_score === 0 ? 'text-danger' : u.stability_score < 70 ? 'text-warning' : 'text-accent';
                const bc = u.stability_score === 0 ? 'border-danger/30 bg-danger/5' : u.stability_score < 70 ? 'border-warning/30 bg-warning/5' : 'border-border bg-surface-elevated';
                return (
                  <div key={u.unit_id} className={`rounded-xl border px-4 py-4 ${bc}`}>
                    <p className="text-xs font-mono font-semibold text-text-primary mb-1">Unit {u.unit_id}</p>
                    <p className={`text-2xl font-bold tabular-nums ${sc}`}>{u.stability_score}</p>
                    <p className="text-xs text-text-muted mt-1">{u.classification}</p>
                    <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-1 text-xs text-text-muted">
                      <span>In: {u.number_of_move_ins}</span>
                      <span>Out: {u.number_of_move_outs}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Summary bar */}
            <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface-elevated border border-border/40 text-xs text-text-muted">
              <span>Total events: <span className="font-semibold text-text-primary">{turnover.portfolio.total_turnover_events}</span></span>
              <span>Units with turnover: <span className="font-semibold text-text-primary">{turnover.portfolio.units_with_turnover}</span></span>
              <span>Units tracked: <span className="font-semibold text-text-primary">{turnover.portfolio.total_units_tracked}</span></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
