'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface IncomeLatest {
  report_date: string;
  total_income: number;
  rental_income: number;
  other_income: number;
  total_expenses: number;
  operating_expenses: number;
  net_operating_income: number;
  profit_margin: number | null;
  mtd: {
    total_income: number;
    rental_income: number;
    other_income: number;
    total_expenses: number;
    operating_expenses: number;
    net_operating_income: number;
  };
}

interface GLEntry {
  date: string;
  type: string;
  unit: string | null;
  debit: string | null;
  credit: string | null;
  description: string | null;
  gl_account_name: string | null;
  party_name: string | null;
}

function fmt$(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (num === null || num === undefined || isNaN(num as number)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num as number);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function MetricRow({ label, ytd, mtd, highlight }: { label: string; ytd: number; mtd: number; highlight?: 'positive' | 'negative' }) {
  const cls = highlight === 'positive' ? 'text-accent' : highlight === 'negative' ? 'text-danger' : 'text-text-primary';
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-4 sm:gap-8">
        <span className={`text-sm font-semibold tabular-nums ${cls}`}>{fmt$(mtd)}</span>
        <span className={`text-sm font-semibold tabular-nums w-24 sm:w-28 text-right ${cls}`}>{fmt$(ytd)}</span>
      </div>
    </div>
  );
}

export default function FinancialsContent() {
  const [income, setIncome] = useState<IncomeLatest | null>(null);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [glAccount, setGlAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [glLoading, setGlLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

  const loadIncome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy?_path=/api/pages/financials/income-statement');
      const json = await res.json();
      setIncome(json?.income_statement ?? null);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const loadGL = useCallback(async (account = '') => {
    setGlLoading(true);
    try {
      const params = new URLSearchParams({ _path: '/api/pages/financials/general-ledger', start_date: start, end_date: end });
      if (account) params.set('account', account);
      const res = await fetch(`/api/proxy?${params}`);
      const json = await res.json();
      setGlEntries(json?.entries ?? []);
    } catch { setGlEntries([]); } finally { setGlLoading(false); }
  }, [start, end]);

  useEffect(() => { loadIncome(); loadGL(); }, [loadIncome, loadGL]);

  const handleGLSearch = (e: React.FormEvent) => { e.preventDefault(); loadGL(glAccount); };
  const totalCredits = glEntries.reduce((s, r) => s + (parseFloat(r.credit ?? '0') || 0), 0);
  const totalDebits  = glEntries.reduce((s, r) => s + (parseFloat(r.debit  ?? '0') || 0), 0);

  const Skeleton = () => <div className="h-7 w-20 bg-surface-elevated animate-pulse rounded" />;
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen p-4 pt-16 sm:pt-16 lg:pt-10 sm:p-6 lg:p-10 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div className="">
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Finance</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">Financials</h1>
          <p className="text-text-secondary text-sm mt-1.5">Income statement and general ledger</p>
        </div>
        <button onClick={loadIncome} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40 flex-shrink-0">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{lastUpdated || 'Refresh'}</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Revenue MTD', val: income?.mtd.total_income, icon: DollarSign, cls: 'text-text-primary' },
          { label: 'Revenue YTD', val: income?.total_income,     icon: TrendingUp, cls: 'text-text-primary' },
          { label: 'NOI MTD',     val: income?.mtd.net_operating_income, icon: BarChart3, cls: 'text-accent' },
          { label: 'NOI YTD',     val: income?.net_operating_income,     icon: BarChart3, cls: 'text-accent' },
        ].map(({ label, val, icon: Icon, cls }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Icon size={13} className="text-accent" />
              </div>
              <p className="text-xs text-text-secondary leading-tight">{label}</p>
            </div>
            {loading ? <Skeleton /> : <p className={`text-xl sm:text-2xl font-bold tabular-nums ${cls}`}>{fmt$(val ?? null)}</p>}
          </div>
        ))}
      </div>

      {/* P&L */}
      <div className="bg-surface border border-border/50 rounded-xl p-4 sm:p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-text-primary">Income Statement</h2>
          <div className="flex items-center gap-4 sm:gap-8 text-xs font-semibold uppercase tracking-wider text-accent/70">
            <span>MTD</span>
            <span className="w-24 sm:w-28 text-right">YTD</span>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded-lg" />)}</div>
        ) : !income ? (
          <p className="text-sm text-text-muted text-center py-8">No data yet. Populates after the 6 AM pipeline run.</p>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 pb-2 border-b border-border/40">Income</p>
            <MetricRow label="Rental Income" ytd={income.rental_income}             mtd={income.mtd.rental_income} />
            <MetricRow label="Other Income"  ytd={income.other_income}              mtd={income.mtd.other_income} />
            <MetricRow label="Total Income"  ytd={income.total_income}              mtd={income.mtd.total_income} highlight="positive" />
            <p className="text-xs font-semibold uppercase tracking-wider text-accent/60 mt-5 mb-2 pb-2 border-b border-border/40">Expenses</p>
            <MetricRow label="Operating Expenses" ytd={income.operating_expenses}   mtd={income.mtd.operating_expenses} />
            <MetricRow label="Total Expenses"     ytd={income.total_expenses}       mtd={income.mtd.total_expenses} highlight="negative" />
            <div className="mt-5 pt-4 border-t-2 border-border/60">
              <MetricRow label="Net Operating Income" ytd={income.net_operating_income} mtd={income.mtd.net_operating_income} highlight="positive" />
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

      {/* GL */}
      <div className="bg-surface border border-border/50 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">General Ledger</h2>
            <p className="text-xs text-text-secondary mt-0.5">{monthLabel}</p>
          </div>
          <form onSubmit={handleGLSearch} className="flex items-center gap-2">
            <input value={glAccount} onChange={e => setGlAccount(e.target.value)}
              placeholder="Filter by account…"
              className="px-3 py-1.5 text-sm bg-surface-elevated border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 w-36 sm:w-44" />
            <button type="submit" disabled={glLoading}
              className="px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent border border-accent/30 rounded-lg hover:bg-accent/25 transition-colors disabled:opacity-40">
              {glLoading ? '…' : 'Filter'}
            </button>
            {glAccount && (
              <button type="button" onClick={() => { setGlAccount(''); loadGL(''); }}
                className="text-xs text-text-muted hover:text-text-secondary">Clear</button>
            )}
          </form>
        </div>

        {glEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 px-3 py-2.5 mb-4 rounded-lg bg-surface-elevated border border-border/40 text-xs text-text-secondary">
            <span>{glEntries.length} entries</span>
            <span className="flex items-center gap-1"><ArrowUpRight size={11} className="text-accent" />Credits: <span className="font-semibold text-accent tabular-nums ml-1">{fmt$(totalCredits)}</span></span>
            <span className="flex items-center gap-1"><ArrowDownRight size={11} className="text-danger" />Debits: <span className="font-semibold text-danger tabular-nums ml-1">{fmt$(totalDebits)}</span></span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border/50">
                {['Date', 'Account', 'Description', 'Party', 'Credit', 'Debit'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {glLoading ? (
                [...Array(5)].map((_, i) => <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-3 py-3"><div className="h-3 bg-surface-elevated animate-pulse rounded w-16" /></td>)}</tr>)
              ) : glEntries.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-text-muted">No entries for this period.</td></tr>
              ) : glEntries.map((e, i) => (
                <tr key={i} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-text-secondary tabular-nums whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary max-w-[130px] truncate">{e.gl_account_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-primary max-w-[160px] truncate">{e.description ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary max-w-[110px] truncate">{e.party_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-accent tabular-nums">{e.credit ? fmt$(e.credit) : '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-danger tabular-nums">{e.debit ? fmt$(e.debit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
