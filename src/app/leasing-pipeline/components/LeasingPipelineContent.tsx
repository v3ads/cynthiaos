'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Users, UserCheck, Clock, Search, X } from 'lucide-react';

interface Prospect {
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  unit_interest: string | null;
  received_date: string | null;
  last_activity: string | null;
  assigned_to: string | null;
}

interface Applicant {
  name: string;
  email: string | null;
  phone: string | null;
  unit_applied_for: string | null;
  status: string;
  received_date: string | null;
  move_in_date: string | null;
  assigned_to: string | null;
}

function fmtDate(val: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val.includes('T') || val.includes('-') ? val : val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return val; }
}

function statusColor(s: string): string {
  const l = (s ?? '').toLowerCase();
  if (l.includes('active') || l.includes('approved') || l.includes('converted')) return 'bg-accent/10 text-accent border-accent/25';
  if (l.includes('pending') || l.includes('prospect')) return 'bg-warning/10 text-warning border-warning/25';
  if (l.includes('denied') || l.includes('inactive') || l.includes('cancelled')) return 'bg-danger/10 text-danger border-danger/25';
  return 'bg-surface-elevated text-text-secondary border-border/40';
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor(status)}`}>{status || '—'}</span>;
}

export default function LeasingPipelineContent() {
  const [prospects, setProspects]   = useState<Prospect[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState<'prospects' | 'applicants'>('prospects');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/proxy?_path=/api/jasmine/prospects'),
        fetch('/api/proxy?_path=/api/jasmine/applicants'),
      ]);
      const pJson = await pRes.json();
      const aJson = await aRes.json();
      setProspects(pJson?.prospects ?? []);
      setApplicants(aJson?.applicants ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeProspects   = prospects.filter(p => p.status?.toLowerCase().includes('active'));
  const pendingApplicants = applicants.filter(a => a.status?.toLowerCase().includes('pending'));
  const approvedApplicants = applicants.filter(a => a.status?.toLowerCase().includes('approved'));

  const allProspectStatuses  = ['all', ...Array.from(new Set(prospects.map(p => p.status).filter(Boolean)))];
  const allApplicantStatuses = ['all', ...Array.from(new Set(applicants.map(a => a.status).filter(Boolean)))];
  const statuses = tab === 'prospects' ? allProspectStatuses : allApplicantStatuses;

  const q = search.trim().toLowerCase();
  const filteredProspects = prospects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!q) return true;
    return [(p.name ?? ''), (p.unit_interest ?? ''), (p.source ?? '')].some(v => v.toLowerCase().includes(q));
  });
  const filteredApplicants = applicants.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (!q) return true;
    return [(a.name ?? ''), (a.unit_applied_for ?? '')].some(v => v.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div className="pl-10 lg:pl-0">
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Leasing</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">Pipeline</h1>
          <p className="text-text-secondary text-sm mt-1.5">Active prospects and applicants from AppFolio</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40 flex-shrink-0">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Active Prospects', val: activeProspects.length,    icon: Users,     cls: 'text-accent',        bg: 'bg-accent/15' },
          { label: 'Total Prospects',  val: prospects.length,           icon: Users,     cls: 'text-text-secondary',bg: 'bg-surface-elevated' },
          { label: 'Pending Apps',     val: pendingApplicants.length,   icon: Clock,     cls: 'text-warning',       bg: 'bg-warning/15' },
          { label: 'Approved Apps',    val: approvedApplicants.length,  icon: UserCheck, cls: 'text-accent',        bg: 'bg-accent/15' },
        ].map(({ label, val, icon: Icon, cls, bg }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}><Icon size={13} className={cls} /></div>
              <p className="text-xs text-text-secondary leading-tight">{label}</p>
            </div>
            {loading ? <div className="h-8 w-10 bg-surface-elevated animate-pulse rounded" /> : <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${cls}`}>{val}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1 mb-5 w-fit">
        {(['prospects', 'applicants'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setStatusFilter('all'); }}
            className={`px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${tab === t ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}>
            {t === 'prospects' ? `Prospects (${prospects.length})` : `Applicants (${applicants.length})`}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-36 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or unit…"
            className="w-full pl-8 pr-8 py-2 text-sm bg-surface border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"><X size={13} /></button>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statuses.slice(0, 5).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${statusFilter === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border/50 text-text-muted hover:text-text-secondary'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {tab === 'prospects'
                  ? ['Name', 'Status', 'Unit Interest', 'Source', 'Last Activity'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                    ))
                  : ['Name', 'Status', 'Unit', 'Received', 'Move-In'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i}>{[...Array(5)].map((_, j) => <td key={j} className="px-3 py-3"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-20" /></td>)}</tr>)
              ) : tab === 'prospects' ? (
                filteredProspects.length === 0
                  ? <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-text-muted">No prospects found.</td></tr>
                  : filteredProspects.map((p, i) => (
                    <tr key={i} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-3 py-3"><p className="text-sm font-medium text-text-primary">{p.name}</p>{p.email && <p className="text-xs text-text-muted">{p.email}</p>}</td>
                      <td className="px-3 py-3"><StatusPill status={p.status} /></td>
                      <td className="px-3 py-3 text-xs text-text-secondary">{p.unit_interest ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary">{p.source ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(p.last_activity)}</td>
                    </tr>
                  ))
              ) : (
                filteredApplicants.length === 0
                  ? <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-text-muted">No applicants found.</td></tr>
                  : filteredApplicants.map((a, i) => (
                    <tr key={i} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-3 py-3"><p className="text-sm font-medium text-text-primary">{a.name}</p>{a.email && <p className="text-xs text-text-muted">{a.email}</p>}</td>
                      <td className="px-3 py-3"><StatusPill status={a.status} /></td>
                      <td className="px-3 py-3 text-xs text-text-secondary">{a.unit_applied_for ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(a.received_date)}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(a.move_in_date)}</td>
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
