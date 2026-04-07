'use client';

import React, { useEffect, useState } from 'react';
import {
  getLeaseExpirations,
  getUpcomingRenewals,
  getPortfolioHealth,
  getAtRiskRevenue,
  getCollectionsRisk,
  getTurnoverVelocity,
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
  AlertTriangle, FileText, RefreshCw, TrendingUp, Zap, Radio,
  ArrowRight, Download, CheckSquare, Flame, ChevronRight, Check,
  ExternalLink, ShieldAlert, Activity, DollarSign, Home,
} from 'lucide-react';
import SummaryCard from '@/components/ui/SummaryCard';
import LeaseTable from '@/components/ui/LeaseTable';
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton';
import UrgencyChart from './UrgencyChart';
import ActionPanel from './ActionPanel';
import Link from 'next/link';
import { computeDerivedIntelligence } from '@/lib/leaseIntelligence';
import { generateTasks, groupTasksByPriority, markTaskCompleted } from '@/lib/taskEngine';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function formatPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function initials(name: string) { return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }

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
          <span className="text-xs text-text-muted">/100</span>
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold text-text-primary mb-1">{classification}</p>
        <p className="text-xs text-text-muted">Overall portfolio score</p>
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
        <span className="text-xs font-semibold text-text-primary tabular-nums">{score}/100</span>
      </div>
      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function UrgencyBadge({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    HIGH: 'bg-danger/10 text-danger border border-danger/20',
    MEDIUM: 'bg-warning/10 text-warning border border-warning/20',
    LOW: 'bg-accent/10 text-accent border border-accent/20',
    'Immediate Action': 'bg-danger/10 text-danger border border-danger/20',
    'High Priority': 'bg-warning/10 text-warning border border-warning/20',
    Monitor: 'bg-surface-elevated text-text-secondary border border-border/50',
    'Low Risk': 'bg-accent/10 text-accent border border-accent/20',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg[level] ?? 'bg-surface-elevated text-text-muted border border-border/50'}`}>{level}</span>;
}

function BucketLabel({ bucket }: { bucket: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    '0_30': { label: '0–30d', cls: 'text-text-muted' },
    '31_60': { label: '31–60d', cls: 'text-warning' },
    '61_90': { label: '61–90d', cls: 'text-danger' },
    '90_plus': { label: '90d+', cls: 'text-danger font-semibold' },
  };
  const cfg = map[bucket] ?? { label: bucket, cls: 'text-text-muted' };
  return <span className={`text-xs tabular-nums ${cfg.cls}`}>{cfg.label}</span>;
}

export default function DashboardContent() {
  const [expirations, setExpirations] = useState<PaginatedResponse<LeaseExpiration> | null>(null);
  const [renewals, setRenewals] = useState<PaginatedResponse<UpcomingRenewal> | null>(null);
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskTenant[]>([]);
  const [collections, setCollections] = useState<CollectionsRiskTenant[]>([]);
  const [turnover, setTurnover] = useState<TurnoverVelocityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [completionTick, setCompletionTick] = useState(0);
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  }, []);

  useEffect(() => {
    Promise.all([getLeaseExpirations(1, 50), getUpcomingRenewals(1, 50)])
      .then(([exp, ren]) => { setExpirations(exp); setRenewals(ren); })
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
    ]).then(([h, ar, col, tv]) => {
      if (h.status === 'fulfilled') setHealth(h.value);
      if (ar.status === 'fulfilled') setAtRisk(ar.value.data);
      if (col.status === 'fulfilled') setCollections(col.value.data);
      if (tv.status === 'fulfilled') setTurnover(tv.value);
    }).finally(() => setInsightsLoading(false));
  }, []);

  const highUrgency   = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH')   || [];
  const mediumUrgency = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'MEDIUM') || [];
  const lowUrgency    = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'LOW')    || [];
  const intelligence  = computeDerivedIntelligence(expirations?.data || []);
  void completionTick;
  const allTasks      = generateTasks(intelligence);
  const openTasks     = allTasks.filter(t => t.status === 'open');
  const grouped       = groupTasksByPriority(openTasks);
  const topPriorities = openTasks.slice(0, 3);

  function handleQuickComplete(taskId: string) {
    markTaskCompleted(taskId);
    setCompletionTick(t => t + 1);
  }

  const urgencyOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const previewLeases = [...(expirations?.data || [])]
    .sort((a, b) => {
      const ua = getUrgencyLevel(a.days_until_expiration);
      const ub = getUrgencyLevel(b.days_until_expiration);
      if (urgencyOrder[ua] !== urgencyOrder[ub]) return urgencyOrder[ua] - urgencyOrder[ub];
      return a.days_until_expiration - b.days_until_expiration;
    })
    .slice(0, 6);

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-2xl mx-auto">

      {/* Page Header */}
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1.5">Operations Center</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Good morning, Cindy</h1>
          <p className="text-text-muted text-sm mt-1.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/ARCHITECTURE.md" download="ARCHITECTURE.md"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors">
            <Download size={13} />Audit Report
          </a>
          <div className="flex items-center gap-2 text-xs text-text-muted bg-surface border border-border rounded-lg px-3 py-2">
            <Radio size={12} className="text-accent animate-pulse" />
            <span className="font-medium">{lastUpdated ? `Live · ${lastUpdated}` : 'Syncing...'}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted mb-8 italic">Start with urgent items, then move to upcoming renewals.</p>

      {/* Priority Banner */}
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

      {/* Portfolio Status */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Portfolio Status</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {loading ? (<><CardSkeleton /><CardSkeleton /><CardSkeleton /></>) : (
          <>
            <SummaryCard title="Total Lease Expirations" value={expirations?.total || 0} subtitle="Across all properties" icon={FileText} variant="muted" />
            <SummaryCard title="Expiring Within 30 Days" value={highUrgency.length} subtitle="Require immediate follow-up" icon={AlertTriangle} variant={highUrgency.length > 0 ? 'danger' : 'default'} />
            <SummaryCard title="Upcoming Renewals (90 days)" value={renewals?.total || 0} subtitle="In renewal pipeline" icon={RefreshCw} variant="muted" />
          </>
        )}
      </div>

      {/* Portfolio Intelligence */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Portfolio Intelligence</p>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-10">

        {/* Health Score */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center"><Activity size={14} className="text-accent" /></div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Portfolio Health</h2>
              <p className="text-xs text-text-muted">Cross-domain intelligence score</p>
            </div>
          </div>
          {insightsLoading || !health ? (
            <div className="h-40 animate-pulse bg-surface-elevated rounded-lg" />
          ) : (
            <>
              <HealthRing score={health.portfolio_health_score} classification={health.classification} />
              <div className="mt-5 pt-4 border-t border-border/50">
                <BreakdownBar label="Financial" score={health.breakdown.financial.score} weight={health.breakdown.financial.weight} />
                <BreakdownBar label="Occupancy" score={health.breakdown.occupancy.score} weight={health.breakdown.occupancy.weight} />
                <BreakdownBar label="Risk"      score={health.breakdown.risk.score}      weight={health.breakdown.risk.weight} />
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
                {[
                  { label: 'Occupancy', val: formatPct(health.supporting_metrics.occupancy_rate), cls: 'text-text-primary' },
                  { label: 'NOI',       val: formatCurrency(health.supporting_metrics.net_operating_income), cls: 'text-text-primary' },
                  { label: 'Delinquency', val: formatCurrency(health.supporting_metrics.total_delinquency_balance), cls: 'text-danger' },
                  { label: 'Margin',    val: formatPct(health.supporting_metrics.profit_margin), cls: 'text-text-primary' },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-xs text-text-muted">{m.label}</p>
                    <p className={`text-sm font-semibold ${m.cls}`}>{m.val}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* At-Risk Revenue */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-danger/15 flex items-center justify-center"><DollarSign size={14} className="text-danger" /></div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">At-Risk Revenue</h2>
                <p className="text-xs text-text-muted">Combined financial + lease risk</p>
              </div>
            </div>
            <Link href="/insights" className="text-xs font-semibold text-accent flex items-center gap-1">All <ChevronRight size={12} /></Link>
          </div>
          {insightsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-surface-elevated rounded-lg" />)}</div>
          ) : atRisk.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Check size={24} className="text-accent mb-2" /><p className="text-sm font-medium text-text-primary">No at-risk tenants</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atRisk.slice(0, 4).map(t => (
                <div key={t.tenant_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated border border-border/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-danger">{initials(t.full_name)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{t.full_name}</p>
                      <p className="text-xs text-text-muted">Unit {t.unit_id} · <BucketLabel bucket={t.dominant_bucket} /></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-sm font-semibold text-danger tabular-nums">{formatCurrency(t.total_balance)}</span>
                    <UrgencyBadge level={t.urgency_level} />
                  </div>
                </div>
              ))}
              {atRisk.length > 4 && (
                <Link href="/insights" className="block text-center text-xs text-accent py-1.5">+{atRisk.length - 4} more →</Link>
              )}
            </div>
          )}
        </div>

        {/* Collections Risk */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-warning/15 flex items-center justify-center"><ShieldAlert size={14} className="text-warning" /></div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Collections Risk</h2>
                <p className="text-xs text-text-muted">Intervention tiers</p>
              </div>
            </div>
            <Link href="/insights" className="text-xs font-semibold text-accent flex items-center gap-1">All <ChevronRight size={12} /></Link>
          </div>
          {insightsLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-surface-elevated rounded-lg" />)}</div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Check size={24} className="text-accent mb-2" /><p className="text-sm font-medium text-text-primary">No collections risk</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map(t => (
                <div key={t.tenant_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated border border-border/40">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{t.full_name}</p>
                    <p className="text-xs text-text-muted">Unit {t.unit_id} · Score {t.collections_risk_score}</p>
                  </div>
                  <div className="flex-shrink-0 ml-2"><UrgencyBadge level={t.collections_classification} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Turnover Velocity */}
      {!insightsLoading && turnover && (
        <>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Turnover Velocity</p>
          <div className="bg-surface border border-border rounded-xl p-6 mb-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center"><Home size={14} className="text-accent" /></div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Unit Stability</h2>
                  <p className="text-xs text-text-muted">
                    Portfolio stability: <span className="font-semibold text-text-primary">{turnover.portfolio.stability_score}/100</span> — {turnover.portfolio.classification}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span>Avg turnover/unit: <span className="font-semibold text-text-primary">{turnover.portfolio.avg_turnover_per_unit.toFixed(1)}</span></span>
                <span>Units tracked: <span className="font-semibold text-text-primary">{turnover.portfolio.total_units_tracked}</span></span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {turnover.data.map(u => {
                const sc = u.stability_score === 0 ? 'text-danger' : u.stability_score < 70 ? 'text-warning' : 'text-accent';
                const bc = u.stability_score === 0 ? 'border-danger/30 bg-danger/5' : u.stability_score < 70 ? 'border-warning/30 bg-warning/5' : 'border-border bg-surface-elevated';
                return (
                  <div key={u.unit_id} className={`rounded-lg border px-3 py-3 ${bc}`}>
                    <p className="text-xs font-mono font-semibold text-text-primary mb-1">Unit {u.unit_id}</p>
                    <p className={`text-xl font-bold tabular-nums ${sc}`}>{u.stability_score}</p>
                    <p className="text-xs text-text-muted mt-0.5">{u.classification}</p>
                    <p className="text-xs text-text-muted mt-1">{u.turnover_count} events</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Intelligence & Actions */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Intelligence & Actions</p>
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
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Work Queue</p>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-10">
            <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center"><CheckSquare size={14} className="text-accent" /></div>
                  <div><h2 className="text-sm font-semibold text-text-primary">Task Summary</h2><p className="text-xs text-text-muted">Open tasks by priority</p></div>
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

            <div className="xl:col-span-3 bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-danger/15 flex items-center justify-center"><Flame size={14} className="text-danger" /></div>
                  <div><h2 className="text-sm font-semibold text-text-primary">Top Priorities</h2><p className="text-xs text-text-muted">Highest-scoring open tasks</p></div>
                </div>
                <Link href="/tasks" className="text-xs font-semibold tracking-wide uppercase text-accent flex items-center gap-1">View All <ChevronRight size={12} /></Link>
              </div>
              {topPriorities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckSquare size={28} className="text-accent mb-3 opacity-60" />
                  <p className="text-sm font-medium text-text-primary">No open tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topPriorities.map((task, idx) => {
                    const pc = task.priority === 'high' ? 'text-danger border-danger/30 bg-danger/5' : task.priority === 'medium' ? 'text-warning border-warning/30 bg-warning/5' : 'text-text-muted border-border bg-surface-elevated';
                    const rc = idx === 0 ? 'bg-danger text-white' : idx === 1 ? 'bg-warning text-white' : 'bg-surface-elevated text-text-muted';
                    const tl = task.type === 'contact' ? 'Contact' : task.type === 'follow_up' ? 'Follow-Up' : 'Stale Check';
                    const ul = task.lease.unit_number ? `Unit ${task.lease.unit_number}` : task.lease.property_name || task.lease_id;
                    return (
                      <div key={task.id} className={`flex items-start gap-3 px-4 py-3.5 rounded-lg border ${pc}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${rc}`}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-semibold text-text-primary truncate">{ul}</span>
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border">{tl}</span>
                          </div>
                          <p className="text-xs text-text-muted leading-snug">{task.reason}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => handleQuickComplete(task.id)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors">
                              <Check size={11} /> Complete
                            </button>
                            <Link href="/tasks" className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface-elevated text-text-muted border border-border hover:text-text-primary transition-colors">
                              <ExternalLink size={11} /> Tasks
                            </Link>
                            {task.lease.id && (
                              <Link href={`/lease-expirations?lease=${task.lease.id}`} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface-elevated text-text-muted border border-border hover:text-text-primary transition-colors">
                                <FileText size={11} /> Lease
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-lg font-bold text-text-primary leading-none">{task.score}</p>
                          <p className="text-xs text-text-muted mt-0.5">score</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Expiration Preview */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Expiration Preview</p>
      <div className="bg-surface border border-border rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-warning/15 flex items-center justify-center"><Zap size={14} className="text-warning" /></div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Most Urgent Expirations</h2>
              <p className="text-xs text-text-muted">Sorted by urgency — top 6 requiring attention</p>
            </div>
          </div>
          <a href="/lease-expirations" className="text-xs font-semibold tracking-wide uppercase text-accent hover:text-accent/80 transition-colors">
            View All {expirations?.total ?? 0} →
          </a>
        </div>
        {loading ? <TableSkeleton rows={6} cols={7} /> : (
          <LeaseTable leases={previewLeases} showActions={false} highlightUrgent showPagination={false} />
        )}
      </div>
    </div>
  );
}
