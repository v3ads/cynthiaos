'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, Users, CheckCircle, BarChart2, X } from 'lucide-react';

interface ConvertedLead {
  name: string;
  unit: string | null;
  date: string | null;
}

interface PlatformStat {
  platform: string;
  leads: number;
  converted: number;
  conversion_rate: number;
  converted_leads: ConvertedLead[];
}

interface PlatformsData {
  platforms: PlatformStat[];
  totals: {
    leads: number;
    converted: number;
    conversion_rate: number;
  };
  fetched_at: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  Zillow: 'bg-blue-500',
  'Apartment List': 'bg-purple-500',
  Avail: 'bg-teal-500',
  'Apartments.com': 'bg-orange-500',
  Zumper: 'bg-pink-500',
  Website: 'bg-accent',
};

function getBarColor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? 'bg-text-muted';
}

function ConversionBar({ rate, max }: { rate: number; max: number }) {
  const width = max > 0 ? (rate / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-text-primary w-10 text-right">
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function fmtDate(val: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val.includes('T') ? val : val + 'T12:00:00');
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return val;
  }
}

function ConvertedModal({
  platform,
  leads,
  onClose,
}: {
  platform: PlatformStat;
  leads: ConvertedLead[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-surface border border-border/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full flex-shrink-0 ${getBarColor(platform.platform)}`}
            />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{platform.platform}</h3>
              <p className="text-xs text-text-secondary">
                {leads.length} converted {leads.length === 1 ? 'lead' : 'leads'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto max-h-80">
          {leads.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
              No converted leads for this platform.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-surface-elevated/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent/80">
                    Name
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent/80">
                    Unit
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent/80">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/20 ${i % 2 === 0 ? '' : 'bg-surface-elevated/20'}`}
                  >
                    <td className="px-5 py-3 font-medium text-text-primary">{lead.name || '—'}</td>
                    <td className="px-5 py-3 text-text-secondary">{lead.unit || '—'}</td>
                    <td className="px-5 py-3 text-text-secondary">{fmtDate(lead.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlatformsContent() {
  const [data, setData] = useState<PlatformsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformStat | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platforms', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load');
      setData(json);
    } catch (e) {
      console.error('Platforms load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close modal on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPlatform(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const maxRate = data ? Math.max(...data.platforms.map((p) => p.conversion_rate), 1) : 1;

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* ── Converted Leads Modal ── */}
      {selectedPlatform && (
        <ConvertedModal
          platform={selectedPlatform}
          leads={selectedPlatform.converted_leads}
          onClose={() => setSelectedPlatform(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="border-b border-border/40 bg-surface px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
              LEASING
            </p>
            <h1 className="text-2xl font-bold text-text-primary">Platforms</h1>
            <p className="text-sm text-text-secondary mt-1">
              Lead sources · conversions · performance by platform
              {data && (
                <span className="ml-2 text-text-secondary/60">
                  · Updated {fmtTime(data.fetched_at)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-surface-elevated hover:bg-border/40 text-text-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* ── Summary Cards ── */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/40 bg-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-text-secondary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent/80">
                  Total Leads
                </span>
              </div>
              <p className="text-3xl font-bold text-text-primary">{data.totals.leads}</p>
              <p className="text-xs text-text-secondary mt-1">
                across {data.platforms.length} platforms
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-text-secondary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent/80">
                  Converted
                </span>
              </div>
              <p className="text-3xl font-bold text-accent">{data.totals.converted}</p>
              <p className="text-xs text-text-secondary mt-1">signed leases</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-text-secondary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent/80">
                  Overall Rate
                </span>
              </div>
              <p className="text-3xl font-bold text-text-primary">
                {data.totals.conversion_rate.toFixed(1)}%
              </p>
              <p className="text-xs text-text-secondary mt-1">lead-to-lease</p>
            </div>
          </div>
        )}

        {/* ── Platform Table ── */}
        <div className="rounded-xl border border-border/40 bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40">
            <BarChart2 size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Performance by Platform</h2>
            {data && data.platforms.some((p) => p.converted > 0) && (
              <span className="ml-auto text-xs text-text-secondary">
                Click a row to see converted leads
              </span>
            )}
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-text-secondary" />
              <span className="ml-2 text-sm text-text-secondary">Loading platform data…</span>
            </div>
          ) : data && data.platforms.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-surface-elevated/50">
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">
                    Platform
                  </th>
                  <th className="text-right px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">
                    Leads
                  </th>
                  <th className="text-right px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80">
                    Conv.
                  </th>
                  <th className="hidden sm:table-cell px-5 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80 w-52">
                    Rate
                  </th>
                  <th className="table-cell sm:hidden px-3 py-3 text-xs font-semibold uppercase tracking-wider text-accent/80 text-right">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.platforms.map((p, i) => (
                  <tr
                    key={p.platform}
                    onClick={() => p.converted > 0 && setSelectedPlatform(p)}
                    className={`border-b border-border/20 transition-colors ${i % 2 === 0 ? '' : 'bg-surface-elevated/20'} ${
                      p.converted > 0
                        ? 'cursor-pointer hover:bg-accent/5'
                        : 'hover:bg-surface-elevated/40'
                    }`}
                  >
                    <td className="px-3 sm:px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${getBarColor(p.platform)}`}
                        />
                        <span
                          className={`font-medium text-text-primary text-xs sm:text-sm ${p.converted > 0 ? 'underline decoration-dotted underline-offset-2' : ''}`}
                        >
                          {p.platform}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 text-right font-medium text-text-primary">
                      {p.leads}
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 text-right">
                      <span
                        className={`font-semibold ${p.converted > 0 ? 'text-accent underline decoration-dotted underline-offset-2 cursor-pointer' : 'text-text-secondary'}`}
                      >
                        {p.converted}
                      </span>
                    </td>
                    {/* Full bar on desktop */}
                    <td className="hidden sm:table-cell px-5 py-3.5">
                      <ConversionBar rate={p.conversion_rate} max={maxRate} />
                    </td>
                    {/* Just the percentage on mobile */}
                    <td className="table-cell sm:hidden px-3 py-3.5 text-right text-xs font-semibold text-text-secondary">
                      {p.conversion_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
              No platform data available.
            </div>
          ) : null}
        </div>

        {/* ── Bar Chart ── */}
        {data && data.platforms.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              Lead Volume by Platform
            </h2>
            <div className="space-y-3">
              {data.platforms.map((p) => {
                const maxLeads = Math.max(...data.platforms.map((x) => x.leads));
                const width = maxLeads > 0 ? (p.leads / maxLeads) * 100 : 0;
                return (
                  <div key={p.platform} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-28 text-right flex-shrink-0">
                      {p.platform}
                    </span>
                    <div className="flex-1 h-6 bg-surface-elevated rounded overflow-hidden">
                      <div
                        className={`h-full ${getBarColor(p.platform)} rounded transition-all duration-700 flex items-center justify-end pr-2`}
                        style={{ width: `${width}%` }}
                      >
                        {width > 15 && (
                          <span className="text-xs font-semibold text-white">{p.leads}</span>
                        )}
                      </div>
                    </div>
                    {width <= 15 && (
                      <span className="text-xs font-semibold text-text-secondary w-6">
                        {p.leads}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
