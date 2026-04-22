'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, X, Phone, Mail, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  company_name: string;
  contact_name: string | null;
  type: string | null;
  trades: string | null;
  email: string | null;
  phone: string | null;
  payment_type: string | null;
  do_not_use: boolean | null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VendorsContent() {
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [trade, setTrade]       = useState('all');

  const load = useCallback(async (t = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ _path: '/api/jasmine/vendors' });
      if (t) params.set('trade', t);
      const res = await fetch(`/api/proxy?${params}`);
      const json = await res.json();
      setVendors(Array.isArray(json) ? json : json?.data ?? []);
    } catch { setVendors([]); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allTrades = Array.from(new Set(
    vendors.flatMap(v => (v.trades ?? v.type ?? '').split(',').map(t => t.trim())).filter(Boolean)
  )).sort();

  const q = search.trim().toLowerCase();
  const filtered = vendors.filter(v => {
    const dnu = v.do_not_use;
    if (trade !== 'all') {
      const vTrades = (v.trades ?? v.type ?? '').toLowerCase();
      if (!vTrades.includes(trade.toLowerCase())) return false;
    }
    if (!q) return true;
    return (
      (v.company_name ?? '').toLowerCase().includes(q) ||
      (v.contact_name ?? '').toLowerCase().includes(q) ||
      (v.trades ?? '').toLowerCase().includes(q) ||
      (v.type ?? '').toLowerCase().includes(q)
    );
  });

  const active  = filtered.filter(v => !v.do_not_use);
  const blocked = filtered.filter(v => v.do_not_use);

  const VendorCard = ({ v }: { v: Vendor }) => (
    <div className={`bg-surface border rounded-xl p-5 transition-colors ${v.do_not_use ? 'border-danger/30 opacity-60' : 'border-border/50 hover:border-border'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{v.company_name}</p>
          {v.contact_name && <p className="text-xs text-text-secondary mt-0.5">{v.contact_name}</p>}
        </div>
        {v.do_not_use && (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/25 flex-shrink-0">
            <AlertCircle size={10} />
            Do Not Use
          </span>
        )}
      </div>
      {(v.trades || v.type) && (
        <p className="text-xs text-accent/80 mb-3 font-medium">{v.trades ?? v.type}</p>
      )}
      <div className="space-y-1.5 border-t border-border/30 pt-3">
        {v.phone && (
          <a href={`tel:${v.phone}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <Phone size={11} className="flex-shrink-0 text-text-muted" />
            {v.phone}
          </a>
        )}
        {v.email && (
          <a href={`mailto:${v.email}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors truncate">
            <Mail size={11} className="flex-shrink-0 text-text-muted" />
            <span className="truncate">{v.email}</span>
          </a>
        )}
        {v.payment_type && (
          <p className="text-xs text-text-muted">Pays via {v.payment_type}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6 lg:p-10 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-border/60 mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Operations</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Vendors</h1>
          <p className="text-text-secondary text-sm mt-1.5">{vendors.length} approved contractors from AppFolio</p>
        </div>
        <button onClick={() => load(trade !== 'all' ? trade : '')} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-40 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Company, contact, trade…"
            className="w-full pl-8 pr-8 py-2 text-sm bg-surface border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
              <X size={13} />
            </button>
          )}
        </div>
        <select value={trade} onChange={e => { setTrade(e.target.value); load(e.target.value !== 'all' ? e.target.value : ''); }}
          className="bg-surface border border-border/50 text-sm text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50 transition-colors">
          <option value="all">All trades</option>
          {allTrades.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-text-muted ml-auto">{active.length} active · {blocked.length} blocked</span>
      </div>

      {/* Active vendors grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-surface border border-border/50 rounded-xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 && blocked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-text-primary">No vendors found</p>
          <p className="text-xs text-text-secondary mt-1">Try adjusting your search.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {active.map(v => <VendorCard key={v.id} v={v} />)}
            </div>
          )}
          {blocked.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-danger/70 mb-3">Do Not Use</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {blocked.map(v => <VendorCard key={v.id} v={v} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
