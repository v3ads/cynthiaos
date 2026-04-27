'use client';

import React, { useEffect, useState } from 'react';
import {
  getLeaseExpirations,
  getUpcomingRenewals,
  getExpiringCount,
  getPortfolioHealth,
  getAtRiskRevenue,
  getCollectionsRisk,
  getTurnoverVelocity,
  getIncomeStatements,
  IncomeStatement,
  LeaseExpiration,
  UpcomingRenewal,
  PaginatedResponse,
  PortfolioHealth,
  AtRiskTenant,
  CollectionsRiskTenant,
  TurnoverVelocityResponse,
} from '@/lib/api';
import { getUrgencyLevel } from '@/lib/urgency';
import {
  AlertTriangle, FileText, RefreshCw, TrendingUp,
  ArrowRight, CheckSquare, ChevronRight, Check,
  ShieldAlert, Activity, DollarSign, Home, Radio,
} from 'lucide-react';
import SummaryCard from '@/components/ui/SummaryCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import UrgencyChart from './UrgencyChart';
import ActionPanel from './ActionPanel';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { computeDerivedIntelligence } from '@/lib/leaseIntelligence';
import { generateTasks, groupTasksByPriority } from '@/lib/taskEngine';

function formatCurrency(n: number | null) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function formatPct(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
function formatName(name: string): string {
  if (!name) return '—';
  // Convert "LAST, FIRST" → "First Last"
  if (/^[A-Z\s,.'\-]+$/.test(name) && name.includes(',')) {
    const [last, ...firstParts] = name.split(',').map(s => s.trim());
    return [firstParts.join(' '), last]
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return name;
}

function HealthRing({ score, classification }: { score: number; classification: string }) {
  const r = 54; const circ = 2 * Math.PI * r; const fill = circ * (score / 100);
  const color = score >= 80 ? 'var(--color-text-success)' : score >= 60 ? 'var(--color-text-warning)' : 'var(--color-text-danger)';
  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width="132" height="132" viewBox="0 0 132 132">
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--color-background-secondary)" strokeWidth="12" />
          <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" transform="rotate(-90 66 66)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-text-primary">{score}</span>
          <span className="text-xs text-text-secondary">%</span>
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold text-text-primary mb-1">{classification}</p>
        <p className="text-xs text-text-secondary">Overall portfolio score</p>
      </div>
    </div>
  );
}

function BreakdownBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary">{label} <span className="text-text-muted">({weight})</span></span>
        <span className="text-xs font-semibold text-text-primary tabular-nums">{score}%</span>
      </div>
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// BreakdownBar is available for future use
void BreakdownBar;

export default function DashboardContent() {
  useAuth(); // keep auth context active
  const [expirations, setExpirations] = useState<PaginatedResponse<LeaseExpiration> | null>(null);
  const [renewals, setRenewals] = useState<PaginatedResponse<UpcomingRenewal> | null>(null);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskTenant[]>([]);
  const [collections, setCollections] = useState<CollectionsRiskTenant[]>([]);
  const [turnover, setTurnover] = useState<TurnoverVelocityResponse | null>(null);
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [expiring30, setExpiring30] = useState<number | null>(null);
  const [expiring90, setExpiring90] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  }, []);

  useEffect(() => {
    Promise.all([getLeaseExpirations(1, 800), getUpcomingRenewals(1, 400)])
      .then(([exp, ren]) => {
        // Deduplicate lease expirations: keep one record per unit (soonest expiration)
        const seenUnits = new Map<string, typeof exp.data[0]>();
        (exp.data || []).forEach(r => {
          const key = r.unit ?? r.unit_id;
          const existing = seenUnits.get(key);
          if (!existing || (r.days_until_expiration ?? 9999) < (existing.days_until_expiration ?? 9999)) {
            seenUnits.set(key, r);
          }
        });
        exp.data = Array.from(seenUnits.values());
        exp.total = exp.data.length;
        setExpirations(exp);
        setRenewals(ren);
      })
      .catch(() => {
        // API failure — leave state as null so UI shows empty/error state
      })
      .finally(() => {
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      });
  }, []);

  useEffect(() => {
    Promise.allSettled([
      getPortfolioHealth(),
      getAtRiskRevenue(),
      getCollectionsRisk(),
      getTurnoverVelocity(),
      getIncomeStatements(),
      getExpiringCount(30),
      getExpiringCount(90),
    ]).then(([h, ar, col, tv, inc, e30, e90]) => {
      if (h.status === 'fulfilled') setHealth(h.value);
      if (ar.status === 'fulfilled') setAtRisk(ar.value.data);
      if (col.status === 'fulfilled') setCollections(col.value.data);
      if (tv.status === 'fulfilled') setTurnover(tv.value);
      if (inc.status === 'fulfilled') setIncome(inc.value.data[0] ?? null);
      if (e30.status === 'fulfilled') setExpiring30(e30.value.total);
      if (e90.status === 'fulfilled') setExpiring90(e90.value.total);
    }).finally(() => setInsightsLoading(false));
  }, []);

  // True once real Gold data has arrived (not just an empty successful response)
  const dataSynced = (expirations?.total ?? 0) > 0 || (renewals?.total ?? 0) > 0;

  const highUrgency   = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH')   || [];
  const mediumUrgency = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'MEDIUM') || [];
  const lowUrgency    = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'LOW')    || [];
  const intelligence  = computeDerivedIntelligence(expirations?.data || []);
  const allTasks      = generateTasks(intelligence);
  const openTasks     = allTasks.filter(t => t.status === 'open');
  const grouped       = groupTasksByPriority(openTasks);

  // Derived totals for At-Risk Revenue and Collections Risk panels
  const atRiskTotal = atRisk.reduce((sum, t) => sum + (t.total_balance ?? 0), 0);
  const collectionsCurrentTotal = collections
    .filter(t => t.tenant_status === 'current')
    .reduce((sum, t) => sum + (t.total_balance ?? 0), 0);
  const collectionsPastTotal = collections
    .filter(t => t.tenant_status === 'past')
    .reduce((sum, t) => sum + (t.total_balance ?? 0), 0);

  return (
    <div className="min-h-screen p-6 pt-16 lg:pt-10 lg:p-10 max-w-screen-2xl mx-auto">

      {/* Page Header */}
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Operations Center</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}, Cindy</h1>
          <p className="text-text-secondary text-sm mt-1.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2">
            <Radio size={12} className="text-accent animate-pulse" />
            <span className="font-medium">{lastUpdated ? `Live · ${lastUpdated}` : 'Syncing...'}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted mb-8 italic">Start with urgent items, then move to upcoming renewals and portfolio health.</p>

      {/* Awaiting sync notice — shown only when Gold tables are empty */}
      {!loading && !dataSynced && (
        <div className="mb-8 flex items-start gap-3 px-5 py-4 rounded-xl border border-border bg-surface-elevated">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Radio size={15} className="text-accent animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Waiting for first AppFolio sync</p>
            <p className="text-xs text-text-secondary mt-0.5">
              The automated cron pipeline runs daily at <span className="font-medium text-text-secondary">6:00 AM Eastern</span>.
              All dashboards and insight modules will populate automatically after the next run.
              No action required.
            </p>
          </div>
        </div>
      )}

      {/* Priority Queue */}
      {loading ? (
        <div className="mb-10 h-28 animate-pulse bg-surface border border-border rounded-xl" />
      ) : highUrgency.length > 0 ? (
        <div className="relative mb-10 rounded-xl border border-danger/50 bg-danger/5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-danger rounded-t-xl" />
          <div className="flex items-center justify-between px-6 py-5 pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-danger/70 mb-0.5">Priority Queue</p>
                <h2 className="text-xl font-bold text-text-primary leading-tight">
                  {highUrgency.length} lease{highUrgency.length > 1 ? 's' : ''} need immediate attention
                </h2>
                <p className="text-sm text-text-muted mt-0.5">Expiring within 30 days — contact tenants now</p>
              </div>
            </div>
            <Link href="/leases-expiring-soon"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors flex-shrink-0 ml-4">
              Review Now <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative mb-10 rounded-xl border border-accent/30 bg-accent/5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent rounded-t-xl" />
          <div className="flex items-center gap-4 px-6 py-5 pt-6">
            <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-accent/70 mb-0.5">Priority Queue</p>
              <h2 className="text-lg font-bold text-text-primary">No critical expirations</h2>
              <p className="text-sm text-text-muted mt-0.5">No leases expiring within 30 days.</p>
            </div>
          </div>
        </div>
      )}

      {/* Intelligence & Actions */}
      <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-3">Intelligence & Actions</p>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-10">
        <div className="xl:col-span-3 bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-text-muted">Urgency Distribution</h2>
              <p className="text-base font-semibold text-text-primary mt-0.5">Lease expirations by urgency level</p>
            </div>
            <TrendingUp size={16} className="text-text-muted" />
          </div>
          {loading ? <div className="h-48 animate-pulse bg-surface-elevated rounded-lg" /> : (
            <UrgencyChart high={highUrgency.length} medium={mediumUrgency.length} low={lowUrgency.length} />
          )}
        </div>
        <div className="xl:col-span-2">
          {loading ? <div className="bg-surface border border-border rounded-xl p-6 h-full animate-pulse" /> : (
            <ActionPanel
              highCount={highUrgency.length} mediumCount={mediumUrgency.length}
              renewalCount={renewals?.data.filter(r => r.renewal_status === 'pending').length || 0}
              declinedCount={renewals?.data.filter(r => r.renewal_status === 'declined').length || 0}
              notContactedCount={intelligence.leasesNotContacted.length}
              flaggedCount={intelligence.flaggedLeases.length}
              staleCount={intelligence.staleLeases.length}
            />
          )}
        </div>
      </div>

      {/* Work Queue */}
      {!loading && (
        <>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-3">Work Queue</p>
          <div className="mb-10">
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center"><CheckSquare size={14} className="text-accent" /></div>
                  <div><h2 className="text-sm font-semibold text-text-primary">Task Summary</h2><p className="text-xs text-text-secondary">Open tasks by priority</p></div>
                </div>
                <Link href="/tasks" className="text-xs font-semibold tracking-wide uppercase text-accent flex items-center gap-1">View All <ChevronRight size={12} /></Link>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border/60 mb-3">
                <span className="text-sm text-text-muted font-medium">Total Open Tasks</span>
                <span className="text-2xl font-bold text-text-primary">{openTasks.length}</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { href: '/tasks', cls: 'bg-danger/10 border-danger/20 hover:border-danger/40', dot: 'bg-danger', label: 'High Priority', count: grouped.high.length, numCls: 'text-danger', arrCls: 'text-danger' },
                  { href: '/tasks', cls: 'bg-warning/10 border-warning/20 hover:border-warning/40', dot: 'bg-warning', label: 'Medium Priority', count: grouped.medium.length, numCls: 'text-warning', arrCls: 'text-warning' },
                  { href: '/tasks', cls: 'bg-surface-elevated border-border hover:border-accent/30', dot: 'bg-text-muted', label: 'Low Priority', count: grouped.low.length, numCls: 'text-text-muted', arrCls: 'text-text-muted' },
                ].map(row => (
                  <Link key={row.label} href={row.href} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors group ${row.cls}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.dot}`} />
                      <span className="text-sm font-medium text-text-primary">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${row.numCls}`}>{row.count}</span>
                      <ArrowRight size={13} className={`${row.arrCls} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Portfolio Status */}
      <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-3">Portfolio Status</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {loading ? (<><CardSkeleton /><CardSkeleton /><CardSkeleton /></>) : (
          <>
            <SummaryCard title="Total Lease Expirations" value={(expirations?.data || []).filter(l => (l.days_until_expiration ?? 0) > 0).length} subtitle="Active leases with upcoming expiry" icon={FileText} variant="muted" />
            <SummaryCard title="Expiring Within 30 Days" value={expiring30 ?? 0} subtitle="Require immediate follow-up" icon={AlertTriangle} variant={(expiring30 ?? 0) > 0 ? 'danger' : 'default'} />
            <SummaryCard title="Upcoming Renewals (90 days)" value={expiring90 ?? 0} subtitle="In renewal pipeline" icon={RefreshCw} variant="muted" />
          </>
        )}
      </div>

      {/* Portfolio Intelligence */}
      <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-3">Portfolio Intelligence</p>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-10">

        {/* Health Score */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center"><Activity size={14} className="text-accent" /></div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Portfolio Health</h2>
              <p className="text-xs text-text-secondary">Cross-domain intelligence score</p>
            </div>
          </div>
          {insightsLoading || !health ? (
            <div className="h-40 animate-pulse bg-surface-elevated rounded-lg" />
          ) : !health.data_availability.occupancy_data && !health.data_availability.financial_data && !health.data_availability.risk_data ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center mb-3">
                <Activity size={18} className="text-text-muted" />
              </div>
              <p className="text-sm font-medium text-text-primary mb-1">Awaiting first sync</p>
              <p className="text-xs text-text-secondary">Cron runs daily at 6:00 AM Eastern.<br />Real AppFolio data will appear after the next run.</p>
            </div>
          ) : (
            <>
              <HealthRing score={health.portfolio_health_score} classification={health.classification} />
              <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                {/* Revenue — combined MTD + YTD card spanning full width */}
                <div className="bg-surface-elevated/50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-text-secondary mb-2">Revenue</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-text-secondary">MTD</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{income ? formatCurrency(income.total_income_mtd) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">YTD</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums">{income ? formatCurrency(income.total_income) : '—'}</p>
                    </div>
                  </div>
                </div>
                {/* Remaining metrics 2-col grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Occupancy',    val: health.supporting_metrics.occupied_units != null && health.supporting_metrics.total_units ? formatPct(health.supporting_metrics.occupied_units / health.supporting_metrics.total_units) : formatPct(health.supporting_metrics.occupancy_rate),  cls: 'text-text-primary' },
                    { label: 'Vacancy Rate', val: health.supporting_metrics.vacant_units != null && health.supporting_metrics.total_units ? formatPct(health.supporting_metrics.vacant_units / health.supporting_metrics.total_units) : formatPct(health.supporting_metrics.vacancy_rate), cls: ((health.supporting_metrics.vacant_units ?? 0) / (health.supporting_metrics.total_units || 180)) > 0.15 ? 'text-danger' : 'text-text-primary' },
                    { label: 'NOI YTD',      val: income ? formatCurrency(income.net_operating_income) : '—',                     cls: 'text-text-primary' },
                    { label: 'Delinquency',  val: formatCurrency(health.supporting_metrics.total_delinquency_balance),             cls: 'text-danger' },
                    { label: 'Expiring 30d', val: expiring30 !== null ? String(expiring30) : '—',                                  cls: (expiring30 ?? 0) > 0 ? 'text-danger' : 'text-text-primary' },
                    { label: 'Expiring 90d', val: expiring90 !== null ? String(expiring90) : '—',                                  cls: (expiring90 ?? 0) > 10 ? 'text-warning' : 'text-text-primary' },
                  ].map(m => (
                    <div key={m.label}>
                      <p className="text-xs text-text-secondary">{m.label}</p>
                      <p className={`text-sm font-semibold tabular-nums ${m.cls}`}>{m.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* At-Risk Revenue — total only */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-danger/15 flex items-center justify-center"><DollarSign size={14} className="text-danger" /></div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">At-Risk Revenue</h2>
                <p className="text-xs text-text-secondary">Combined financial + lease risk</p>
              </div>
            </div>
            <Link href="/insights" className="text-xs font-semibold text-accent flex items-center gap-1">All <ChevronRight size={12} /></Link>
          </div>
          {insightsLoading ? (
            <div className="h-24 animate-pulse bg-surface-elevated rounded-lg" />
          ) : atRisk.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Check size={24} className="text-accent mb-2" /><p className="text-sm font-medium text-text-primary">No at-risk tenants</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <p className="text-4xl font-bold text-danger tabular-nums">{formatCurrency(atRiskTotal)}</p>
              <p className="text-xs text-text-secondary">{atRisk.length} tenant{atRisk.length !== 1 ? 's' : ''} at risk</p>
            </div>
          )}
        </div>

        {/* Collections Risk — total only */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-warning/15 flex items-center justify-center"><ShieldAlert size={14} className="text-warning" /></div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Collections Risk</h2>
                <p className="text-xs text-text-secondary">Intervention tiers</p>
              </div>
            </div>
            <Link href="/insights" className="text-xs font-semibold text-accent flex items-center gap-1">All <ChevronRight size={12} /></Link>
          </div>
          {insightsLoading ? (
            <div className="h-24 animate-pulse bg-surface-elevated rounded-lg" />
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Check size={24} className="text-accent mb-2" /><p className="text-sm font-medium text-text-primary">No collections risk</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col items-center justify-center gap-1">
                <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold">Current Tenants</p>
                <p className="text-3xl font-bold text-warning tabular-nums">{formatCurrency(collectionsCurrentTotal)}</p>
                <p className="text-xs text-text-secondary">{collections.filter(t => t.tenant_status === 'current').length} tenant{collections.filter(t => t.tenant_status === 'current').length !== 1 ? 's' : ''}</p>
              </div>
              <div className="border-t border-border/50" />
              <div className="flex flex-col items-center justify-center gap-1">
                <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold">Past Tenants</p>
                <p className="text-3xl font-bold text-danger tabular-nums">{formatCurrency(collectionsPastTotal)}</p>
                <p className="text-xs text-text-secondary">{collections.filter(t => t.tenant_status === 'past').length} former tenant{collections.filter(t => t.tenant_status === 'past').length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Turnover Velocity */}
      {!insightsLoading && turnover && (
        <>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-3">Turnover Velocity</p>
          <div className="bg-surface border border-border rounded-xl p-5 mb-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <Home size={15} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Portfolio stability: <span className={turnover.portfolio.stability_score >= 80 ? 'text-accent' : turnover.portfolio.stability_score >= 60 ? 'text-warning' : 'text-danger'}>{turnover.portfolio.stability_score}%</span>
                    <span className="text-text-muted font-normal ml-1.5">— {turnover.portfolio.classification}</span>
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Avg turnover/unit: <span className="font-semibold text-text-primary">{turnover.portfolio.avg_turnover_per_unit.toFixed(1)}</span>
                    <span className="mx-2 text-border">·</span>
                    Units tracked: <span className="font-semibold text-text-primary">{turnover.portfolio.total_units_tracked}</span>
                  </p>
                </div>
              </div>
              <Link href="/unit-turns" className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors flex-shrink-0">
                View details
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
