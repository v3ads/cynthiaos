'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncomeStatement {
  id: string;
  report_date: string;
  total_income: number;
  rental_income: number;
  other_income: number;
  total_expenses: number;
  operating_expenses: number;
  net_operating_income: number;
  profit_margin: number | null;
  total_income_mtd: number;
  rental_income_mtd: number;
  other_income_mtd: number;
  total_expenses_mtd: number;
  operating_expenses_mtd: number;
  net_operating_income_mtd: number;
  created_at: string;
}

interface GLEntry {
  id: string;
  post_date: string;
  txn_type: string;
  unit_id: string | null;
  debit: number;
  credit: number;
  description: string | null;
  gl_account_name: string | null;
  party_name: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({ label, ytd, mtd, highlight }: { label: string; ytd: number; mtd: number; highlight?: 'positive' | 'negative' }) {
  const cls = highlight === 'positive' ? 'text-accent' : highlight === 'negative' ? 'text-danger' : 'text-text-primary';
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-8">
        <span className={`text-sm font-semibold tabular-nums ${cls}`}>{fmt$(mtd)}</span>
        <span className={`text-sm font-semibold tabular-nums w-28 text-right ${cls}`}>{fmt$(ytd)}</span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FinancialsContent() {
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [glAccount, setGlAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [glLoading, setGlLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const { start, end } = getCurrentMonthRange();

  const loadIncome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy?_path=/api/v1/income&limit=1');
      const json = await res.json();
      const rows = Array.isArray(json) ? json : json?.data ?? [];
      setIncome(rows[0] ?? null);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  const loadGL = useCallback(async (account = '') => {
    setGlLoading(true);
    try {
      const params = new URLSearchParams({ _path: '/api/jasmine/general-ledger', start_date: start, end_date: end });
      if (account) params.set('account', account);
      const res = await fetch(`/api/proxy?${params}`);
      const json = await res.json();
      setGlEntries(Array.isArray(json) ? json : json?.data ?? []);
    } catch { setGlEntries([]); } finally {
      setGlLoading(false);
    }
  }, [start, end]);

  useEffect(() => { loadIncome(); loadGL(); }, [loadIncome, loadGL]);

  const handleGLSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadGL(glAccount);
  };

  const totalCredits = glEntries.reduce((s, r) => s + (r.credit || 0), 0);
  const totalDebits  = glEntries.reduce((s, r) => s + (r.debit || 0), 0);

  const Skeleton = () => <div className="h-5 w-24 bg-surface-elevated animate-pulse rounded" />;

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Finance</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Financials</h1>
          <p className="text-text-secondary text-sm mt-1.5">Income statement and general ledger — powered by Gold layer</p>
        </div>
        <button onClick={loadIncome} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {lastUpdated ? `${lastUpdated}` : 'Refresh'}
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Revenue MTD', val: income?.total_income_mtd, icon: DollarSign, variant: 'default' },
          { label: 'Revenue YTD', val: income?.total_income, icon: TrendingUp, variant: 'default' },
          { label: 'NOI MTD', val: income?.net_operating_income_mtd, icon: BarChart3, variant: 'positive' },
          { label: 'NOI YTD', val: income?.net_operating_income, icon: BarChart3, variant: 'positive' },
        ].map(({ label, val, icon: Icon, variant }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                <Icon size={14} className="text-accent" />
              </div>
              <p className="text-xs text-text-secondary">{label}</p>
            </div>
            {loading ? <Skeleton /> : (
              <p className={`text-2xl font-bold tabular-nums ${variant === 'positive' ? 'text-accent' : 'text-text-primary'}`}>
                {fmt$(val ?? null)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* P&L Table */}
      <div className="bg-surface border border-border/50 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-text-primary">Income Statement</h2>
          <div className="flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-accent/70">
            <span>MTD</span>
            <span className="w-28 text-right">YTD</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded-lg" />)}</div>
        ) : !income ? (
          <p className="text-sm text-text-muted text-center py-8">No income statement data yet. Data populates after the 6 AM pipeline run.</p>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 pb-2 border-b border-border/40">Income</p>
            <MetricRow label="Rental Income" ytd={income.rental_income} mtd={income.rental_income_mtd} />
            <MetricRow label="Other Income"  ytd={income.other_income}  mtd={income.other_income_mtd} />
            <MetricRow label="Total Income"  ytd={income.total_income}  mtd={income.total_income_mtd} highlight="positive" />

            <p className="text-xs font-semibold uppercase tracking-wider text-accent/60 mt-5 mb-2 pb-2 border-b border-border/40">Expenses</p>
            <MetricRow label="Operating Expenses" ytd={income.operating_expenses}  mtd={income.operating_expenses_mtd} />
            <MetricRow label="Total Expenses"      ytd={income.total_expenses}      mtd={income.total_expenses_mtd} highlight="negative" />

            <div className="mt-5 pt-4 border-t-2 border-border/60">
              <MetricRow label="Net Operating Income" ytd={income.net_operating_income} mtd={income.net_operating_income_mtd} highlight="positive" />
              {income.profit_margin !== null && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-text-secondary">Profit Margin</span>
                  <span className="text-sm font-semibold text-accent tabular-nums">{fmtPct(income.profit_margin)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* General Ledger */}
      <div className="bg-surface border border-border/50 rounded-xl p-6">
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-text-primary">General Ledger</h2>
            <p className="text-xs text-text-secondary mt-0.5">Current month · {new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
          <form onSubmit={handleGLSearch} className="flex items-center gap-2">
            <input
              value={glAccount}
              onChange={e => setGlAccount(e.target.value)}
              placeholder="Filter by account…"
              className="px-3 py-1.5 text-sm bg-surface-elevated border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors w-44"
            />
            <button type="submit" disabled={glLoading}
              className="px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent border border-accent/30 rounded-lg hover:bg-accent/25 transition-colors disabled:opacity-40">
              {glLoading ? '…' : 'Filter'}
            </button>
            {glAccount && (
              <button type="button" onClick={() => { setGlAccount(''); loadGL(''); }}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                Clear
              </button>
            )}
          </form>
        </div>

        {/* GL summary row */}
        {glEntries.length > 0 && (
          <div className="flex items-center gap-6 px-4 py-3 mb-4 rounded-lg bg-surface-elevated border border-border/40 text-xs text-text-secondary">
            <span>{glEntries.length} entries</span>
            <span className="flex items-center gap-1">
              <ArrowUpRight size={12} className="text-accent" />
              Credits: <span className="font-semibold text-accent tabular-nums ml-1">{fmt$(totalCredits)}</span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownRight size={12} className="text-danger" />
              Debits: <span className="font-semibold text-danger tabular-nums ml-1">{fmt$(totalDebits)}</span>
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border/50">
                {['Date', 'Account', 'Description', 'Party', 'Credit', 'Debit'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {glLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : glEntries.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-text-muted">No entries for this period.</td></tr>
              ) : (
                glEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-text-secondary tabular-nums whitespace-nowrap">{fmtDate(entry.post_date)}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary max-w-[140px] truncate">{entry.gl_account_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-text-primary max-w-[180px] truncate">{entry.description ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary max-w-[120px] truncate">{entry.party_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-accent tabular-nums">{entry.credit ? fmt$(entry.credit) : '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-danger tabular-nums">{entry.debit ? fmt$(entry.debit) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
