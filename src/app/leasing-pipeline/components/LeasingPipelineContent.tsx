'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Users, UserCheck, Search, X } from 'lucide-react';

interface Prospect {
  guest_card_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  unit_name: string | null;
  bed_bath_preference: string | null;
  max_rent: number | null;
  move_in_preference: string | null;
  last_activity_date: string | null;
  assigned_user: string | null;
}

interface Applicant {
  application_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  unit_name: string | null;
  status: string;
  application_status: string | null;
  received_date: string | null;
  desired_move_in: string | null;
  monthly_rent: number | null;
}

function fmt$(n: number | null): string {
  if (!n) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(val: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val.length === 10 ? val + 'T12:00:00' : val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return val; }
}

function statusColor(s: string): string {
  const l = (s ?? '').toLowerCase();
  if (l.includes('active'))    return 'bg-accent/10 text-accent border-accent/25';
  if (l.includes('converted') || l.includes('approved')) return 'bg-info/10 text-info border-info/25';
  if (l.includes('pending'))   return 'bg-warning/10 text-warning border-warning/25';
  if (l.includes('denied') || l.includes('cancelled') || l.includes('inactive')) return 'bg-danger/10 text-danger border-danger/25';
  return 'bg-surface-elevated text-text-secondary border-border/40';
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor(status)}`}>{status || '—'}</span>;
}

export default function LeasingPipelineContent() {
  const [prospects,  setProspects]  = useState<Prospect[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [tab,        setTab]        = useState<'prospects' | 'applicants'>('prospects');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/proxy?_path=/api/pages/leasing-pipeline/prospects'),
        fetch('/api/proxy?_path=/api/pages/leasing-pipeline/applicants'),
      ]);
      const pJson = await pRes.json();
      const aJson = await aRes.json();
      setProspects(pJson?.prospects ?? []);
      setApplicants(aJson?.applicants ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeProspects    = prospects.filter(p => p.status?.toLowerCase() === 'active');
  const convertedApplicants = applicants.filter(a => a.status?.toLowerCase() === 'converted');

  const prospectStatuses  = ['all', ...Array.from(new Set(prospects.map(p => p.status).filter(Boolean)))];
  const applicantStatuses = ['all', ...Array.from(new Set(applicants.map(a => a.status).filter(Boolean)))];
  const statuses = tab === 'prospects' ? prospectStatuses : applicantStatuses;

  const q = search.trim().toLowerCase();
  const filteredProspects = prospects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!q) return true;
    return [(p.name ?? ''), (p.unit_name ?? ''), (p.source ?? '')].some(v => v.toLowerCase().includes(q));
  });
  const filteredApplicants = applicants.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (!q) return true;
    return [(a.name ?? ''), (a.unit_name ?? '')].some(v => v.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen p-4 pt-16 sm:pt-16 lg:pt-10 sm:p-6 lg:p-10 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Active Prospects',  val: activeProspects.length,     cls: 'text-accent',        bg: 'bg-accent/15',        icon: Users },
          { label: 'Total Prospects',   val: prospects.length,           cls: 'text-text-secondary',bg: 'bg-surface-elevated', icon: Users },
          { label: 'Total Applicants',  val: applicants.length,          cls: 'text-text-primary',  bg: 'bg-surface-elevated', icon: UserCheck },
          { label: 'Converted',         val: convertedApplicants.length, cls: 'text-accent',        bg: 'bg-accent/15',        icon: UserCheck },
        ].map(({ label, val, cls, bg, icon: Icon }) => (
          <div key={label} className="bg-surface border border-border/50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}><Icon size={13} className={cls} /></div>
              <p className="text-xs text-text-secondary leading-tight">{label}</p>
            </div>
            {loading ? <div className="h-8 w-10 bg-surface-elevated animate-pulse rounded" />
              : <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${cls}`}>{val}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 bg-surface border border-border/50 rounded-lg p-1 mb-5 w-fit">
        {(['prospects', 'applicants'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setStatusFilter('all'); }}
            className={`px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${tab === t ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'}`}>
            {t === 'prospects' ? `Prospects (${prospects.length})` : `Applicants (${applicants.length})`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-36 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or unit…"
            className="w-full pl-8 pr-8 py-2 text-sm bg-surface border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"><X size={13} /></button>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${statusFilter === s ? 'bg-accent/15 text-accent border-accent/30' : 'border-border/50 text-text-muted hover:text-text-secondary'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {tab === 'prospects'
                  ? ['Name', 'Status', 'Unit Interest', 'Beds', 'Max Rent', 'Move-In', 'Last Activity'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                    ))
                  : ['Name', 'Status', 'Unit', 'Rent', 'Received', 'Move-In'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">{h}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-3 py-3"><div className="h-3.5 bg-surface-elevated animate-pulse rounded w-20" /></td>)}</tr>)
              ) : tab === 'prospects' ? (
                filteredProspects.length === 0
                  ? <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-text-muted">No prospects found.</td></tr>
                  : filteredProspects.map(p => (
                    <tr key={p.guest_card_id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-3 py-3"><p className="text-sm font-medium text-text-primary">{p.name}</p>{p.email && <p className="text-xs text-text-muted">{p.email}</p>}</td>
                      <td className="px-3 py-3"><StatusPill status={p.status} /></td>
                      <td className="px-3 py-3 text-xs text-text-secondary">{p.unit_name ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary">{p.bed_bath_preference ?? '—'}</td>
                      <td className="px-3 py-3 text-xs font-medium text-text-primary tabular-nums">{fmt$(p.max_rent)}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(p.move_in_preference)}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(p.last_activity_date)}</td>
                    </tr>
                  ))
              ) : (
                filteredApplicants.length === 0
                  ? <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-text-muted">No applicants found.</td></tr>
                  : filteredApplicants.map(a => (
                    <tr key={a.application_id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-3 py-3"><p className="text-sm font-medium text-text-primary">{a.name}</p>{a.email && <p className="text-xs text-text-muted">{a.email}</p>}</td>
                      <td className="px-3 py-3"><StatusPill status={a.application_status ?? a.status} /></td>
                      <td className="px-3 py-3 text-xs text-text-secondary">{a.unit_name ?? '—'}</td>
                      <td className="px-3 py-3 text-xs font-medium text-text-primary tabular-nums">{fmt$(a.monthly_rent)}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(a.received_date)}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary tabular-nums">{fmtDate(a.desired_move_in)}</td>
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
