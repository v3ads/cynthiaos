'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Database, ShieldCheck, Activity, Clock, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntegrityCheck {
  check: string;
  table: string;
  passed: boolean;
  detail: string;
  actual?: number;
  expected?: string;
}

interface IntegrityReport {
  run_at: string;
  all_passed: boolean;
  checks: IntegrityCheck[];
}

interface IntegrityResponse {
  success: boolean;
  all_passed: boolean;
  report: IntegrityReport;
}

interface PipelineLog {
  id: string;
  logged_at: string;
  stage: string;
  report_type: string;
  row_count: number;
  anomaly_count: number;
  validation_status: 'passed' | 'warned' | 'failed';
  detail?: Record<string, unknown>;
}

interface LogsResponse {
  success: boolean;
  count: number;
  logs: PipelineLog[];
}

// ─── Gold table record counts from API ───────────────────────────────────────

interface GoldTableStat {
  label: string;
  endpoint: string;
  count: number | null;
  loading: boolean;
}

const TRANSFORM_BASE = 'https://cynthiaos-transform-worker-production.up.railway.app';
const API_BASE = 'https://cynthiaos-api-production.up.railway.app';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: 'passed' | 'warned' | 'failed' | 'loading' }) {
  const cfg = {
    passed:  'bg-success/10 text-success border-success/25',
    warned:  'bg-warning/10 text-warning border-warning/25',
    failed:  'bg-danger/10 text-danger border-danger/25',
    loading: 'bg-surface-elevated text-text-muted border-border/40',
  }[status];
  const label = { passed: 'Passed', warned: 'Warning', failed: 'Failed', loading: '…' }[status];
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${cfg}`}>
      {label}
    </span>
  );
}

function CheckIcon({ passed }: { passed: boolean }) {
  return passed
    ? <CheckCircle2 size={15} className="text-success flex-shrink-0" />
    : <XCircle size={15} className="text-danger flex-shrink-0" />;
}

function CheckTypeLabel({ check }: { check: string }) {
  const cfg: Record<string, string> = {
    row_count:     'bg-surface-elevated text-text-secondary border-border/40',
    sentinel_value:'bg-warning/8 text-warning border-warning/20',
    join_health:   'bg-accent/8 text-accent border-accent/20',
  };
  const label: Record<string, string> = {
    row_count: 'Row Count',
    sentinel_value: 'Sentinel',
    join_health: 'Join Health',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cfg[check] ?? 'bg-surface-elevated text-text-muted border-border'}`}>
      {label[check] ?? check}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PipelineContent() {
  const [integrity, setIntegrity]   = useState<IntegrityResponse | null>(null);
  const [logs, setLogs]             = useState<PipelineLog[]>([]);
  const [tableStats, setTableStats] = useState<GoldTableStat[]>([
    { label: 'Tenants',          endpoint: '/api/v1/tenants?limit=1',              count: null, loading: true },
    { label: 'Lease Expirations',endpoint: '/api/v1/leases/expirations?limit=1',   count: null, loading: true },
    { label: 'Delinquency',      endpoint: '/api/v1/delinquency?limit=1',           count: null, loading: true },
    { label: 'Aged Receivables', endpoint: '/api/v1/aged-receivables?limit=1',      count: null, loading: true },
    { label: 'Occupancy',        endpoint: '/api/v1/occupancy?limit=1',             count: null, loading: true },
    { label: 'Income',           endpoint: '/api/v1/income?limit=1',               count: null, loading: true },
    { label: 'Turnover Events',  endpoint: '/api/v1/turnover?limit=1',             count: null, loading: true },
  ]);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    // Integrity + logs in parallel
    const [intRes, logRes] = await Promise.allSettled([
      fetch(`${TRANSFORM_BASE}/validation/integrity`).then(r => r.json()),
      fetch(`${TRANSFORM_BASE}/validation/logs?limit=20`).then(r => r.json()),
    ]);

    if (intRes.status === 'fulfilled') setIntegrity(intRes.value as IntegrityResponse);
    if (logRes.status === 'fulfilled') setLogs((logRes.value as LogsResponse).logs ?? []);

    // Gold table stats
    const updated = await Promise.all(
      tableStats.map(async (stat) => {
        try {
          const res = await fetch(`${API_BASE}${stat.endpoint}`);
          const data = await res.json();
          return { ...stat, count: data.total ?? null, loading: false };
        } catch {
          return { ...stat, count: null, loading: false };
        }
      })
    );
    setTableStats(updated);
    setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Derived state
  const allPassed = integrity?.all_passed ?? null;
  const checks    = integrity?.report?.checks ?? [];
  const passedCount  = checks.filter(c => c.passed).length;
  const failedCount  = checks.filter(c => !c.passed).length;
  const lastRun      = integrity?.report?.run_at ?? null;
  const warnLogs     = logs.filter(l => l.validation_status === 'warned').length;
  const errorLogs    = logs.filter(l => l.validation_status === 'failed').length;

  // Group checks by table
  const checksByTable: Record<string, IntegrityCheck[]> = {};
  checks.forEach(c => {
    if (!checksByTable[c.table]) checksByTable[c.table] = [];
    checksByTable[c.table].push(c);
  });

  const overallStatus = allPassed === null
    ? 'loading'
    : allPassed ? 'passed'
    : errorLogs > 0 ? 'failed'
    : 'warned';

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1.5">System</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Pipeline Monitor</h1>
          <p className="text-text-muted text-sm mt-1.5">
            Data validation layer · AppFolio → Bronze → Silver → Gold
            {lastRun && <span className="ml-2 text-text-muted/60">· Last integrity run: {timeAgo(lastRun)}</span>}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {lastRefresh ? `Refreshed ${lastRefresh}` : 'Refresh'}
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          {
            icon: ShieldCheck,
            label: 'Integrity Status',
            value: allPassed === null ? '…' : allPassed ? 'All Clear' : 'Issues Found',
            cls: allPassed === null ? 'text-text-muted' : allPassed ? 'text-success' : 'text-danger',
            iconCls: allPassed === null ? 'bg-surface-elevated text-text-muted' : allPassed ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
          },
          {
            icon: CheckCircle2,
            label: 'Checks Passing',
            value: loading ? '…' : `${passedCount} / ${checks.length}`,
            cls: failedCount > 0 ? 'text-danger' : 'text-success',
            iconCls: 'bg-success/15 text-success',
          },
          {
            icon: AlertTriangle,
            label: 'Warnings (logs)',
            value: loading ? '…' : String(warnLogs),
            cls: warnLogs > 0 ? 'text-warning' : 'text-text-primary',
            iconCls: warnLogs > 0 ? 'bg-warning/15 text-warning' : 'bg-surface-elevated text-text-muted',
          },
          {
            icon: Clock,
            label: 'Next Cron Run',
            value: '6:00 AM ET',
            cls: 'text-text-primary',
            iconCls: 'bg-accent/15 text-accent',
          },
        ].map(card => (
          <div key={card.label} className="bg-surface border border-border/50 rounded-xl px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${card.iconCls}`}>
                <card.icon size={14} />
              </div>
              <p className="text-xs text-text-muted">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${card.cls}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Gold Table Counts ──────────────────────────────────────────── */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Gold Layer — Record Counts</p>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-8">
        {tableStats.map(stat => (
          <div key={stat.label} className="bg-surface border border-border/40 rounded-xl px-3 py-3 text-center">
            <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center mx-auto mb-2">
              <Database size={13} className="text-text-muted" />
            </div>
            {stat.loading ? (
              <div className="h-7 w-10 animate-pulse bg-surface-elevated rounded mx-auto mb-1" />
            ) : (
              <p className={`text-xl font-bold tabular-nums ${stat.count === 0 ? 'text-danger' : stat.count === null ? 'text-text-muted' : 'text-text-primary'}`}>
                {stat.count ?? '—'}
              </p>
            )}
            <p className="text-xs text-text-muted mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Integrity Checks ──────────────────────────────────────────── */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Integrity Checks</p>
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${overallStatus === 'passed' ? 'bg-success/15' : overallStatus === 'failed' ? 'bg-danger/15' : 'bg-warning/15'}`}>
              <Activity size={14} className={overallStatus === 'passed' ? 'text-success' : overallStatus === 'failed' ? 'text-danger' : 'text-warning'} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Validation Report</p>
              <p className="text-xs text-text-muted">{lastRun ? `Run at ${formatTime(lastRun)}` : 'Loading…'}</p>
            </div>
          </div>
          <StatusPill status={overallStatus} />
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-surface-elevated rounded-lg" />)}
          </div>
        ) : Object.keys(checksByTable).length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No integrity data available.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {Object.entries(checksByTable).map(([table, tableChecks]) => {
              const allOk = tableChecks.every(c => c.passed);
              return (
                <div key={table} className={`px-5 py-3 ${!allOk ? 'bg-danger/3' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold font-mono text-text-secondary">{table}</p>
                    {!allOk && <span className="text-xs text-danger font-medium">· issues detected</span>}
                  </div>
                  <div className="space-y-1.5">
                    {tableChecks.map((check, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckIcon passed={check.passed} />
                        <CheckTypeLabel check={check.check} />
                        <p className="text-xs text-text-secondary leading-relaxed flex-1">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pipeline Logs ─────────────────────────────────────────────── */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Pipeline Logs</p>
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center">
              <Zap size={14} className="text-text-muted" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Validation History</p>
              <p className="text-xs text-text-muted">Last 20 pipeline log entries</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            {warnLogs > 0 && <span className="text-warning font-medium">{warnLogs} warning{warnLogs > 1 ? 's' : ''}</span>}
            {errorLogs > 0 && <span className="text-danger font-medium">{errorLogs} error{errorLogs > 1 ? 's' : ''}</span>}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-surface-elevated rounded-lg" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No logs yet — logs are written after each pipeline run.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  {['Time', 'Stage', 'Report Type', 'Rows', 'Anomalies', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {logs.map(log => (
                  <tr key={log.id} className={`hover:bg-surface-elevated/50 transition-colors ${log.validation_status === 'failed' ? 'bg-danger/3' : log.validation_status === 'warned' ? 'bg-warning/3' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-text-muted tabular-nums whitespace-nowrap">
                      {formatDate(log.logged_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono font-medium text-text-secondary">{log.stage}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary font-mono">{log.report_type}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-text-secondary">{log.row_count ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {log.anomaly_count > 0
                        ? <span className="text-xs font-semibold text-warning">{log.anomaly_count}</span>
                        : <span className="text-xs text-text-muted">0</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={log.validation_status} />
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
