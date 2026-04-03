'use client';

import React, { useEffect, useState } from 'react';
import { getLeaseExpirations, getUpcomingRenewals, LeaseExpiration, UpcomingRenewal, PaginatedResponse } from '@/lib/api';
import { getUrgencyLevel } from '@/lib/urgency';
import { AlertTriangle, FileText, RefreshCw, TrendingUp, Zap, Radio, ArrowRight, Download, CheckSquare, Flame, ChevronRight, Check, ExternalLink } from 'lucide-react';
import SummaryCard from '@/components/ui/SummaryCard';
import LeaseTable from '@/components/ui/LeaseTable';
import { CardSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton';
import UrgencyChart from './UrgencyChart';
import ActionPanel from './ActionPanel';
import Link from 'next/link';
import { computeDerivedIntelligence } from '@/lib/leaseIntelligence';
import { generateTasks, groupTasksByPriority, markTaskCompleted } from '@/lib/taskEngine';

export default function DashboardContent() {
  const [expirations, setExpirations] = useState<PaginatedResponse<LeaseExpiration> | null>(null);
  const [renewals, setRenewals] = useState<PaginatedResponse<UpcomingRenewal> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [completionTick, setCompletionTick] = useState(0);
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  }, []);

  useEffect(() => {
    Promise.all([getLeaseExpirations(1, 50), getUpcomingRenewals(1, 50)])
      .then(([exp, ren]) => {
        setExpirations(exp);
        setRenewals(ren);
      })
      .finally(() => {
        setLoading(false);
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      });
  }, []);

  const highUrgency = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'HIGH') || [];
  const mediumUrgency = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'MEDIUM') || [];
  const lowUrgency = expirations?.data.filter(l => getUrgencyLevel(l.days_until_expiration) === 'LOW') || [];

  // Derived intelligence from lease + action state
  const intelligence = computeDerivedIntelligence(expirations?.data || []);

  // Task metrics derived from task engine.
  // completionTick increments on quick-complete to force a re-render that re-reads localStorage.
  void completionTick;
  const allTasks = generateTasks(intelligence);
  const openTasks = allTasks.filter(t => t.status === 'open');
  const grouped = groupTasksByPriority(openTasks);
  const topPriorities = openTasks.slice(0, 3);

  function handleQuickComplete(taskId: string) {
    markTaskCompleted(taskId);
    setCompletionTick(t => t + 1);
  }

  // Sort preview leases: HIGH urgency first, then by days ascending
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
          <a
            href="/ARCHITECTURE.md"
            download="ARCHITECTURE.md"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors"
          >
            <Download size={13} />
            Audit Report
          </a>
          <div className="flex items-center gap-2 text-xs text-text-muted bg-surface border border-border rounded-lg px-3 py-2">
            <Radio size={12} className="text-accent animate-pulse" />
            <span className="font-medium">{lastUpdated ? `Live · ${lastUpdated}` : 'Syncing...'}</span>
          </div>
        </div>
      </div>

      {/* Workflow Hint */}
      <p className="text-xs text-text-muted mb-8 italic">
        Start with urgent items, then move to upcoming renewals.
      </p>

      {/* ── PRIORITY QUEUE ─────────────────────────────────────────── */}
      {loading ? (
        <div className="mb-10 h-28 animate-pulse bg-surface border border-border rounded-xl" />
      ) : highUrgency.length > 0 ? (
        <div className="relative mb-10 rounded-xl border border-danger/50 bg-danger/5 overflow-hidden">
          {/* Red top accent bar */}
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
            <Link
              href="/leases-expiring-soon"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors flex-shrink-0 ml-4"
            >
              Review Now
              <ArrowRight size={15} />
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
              <p className="text-sm text-text-muted mt-0.5">No leases expiring within 30 days — you're on track.</p>
            </div>
          </div>
        </div>
      )}

      {/* Section Label */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Portfolio Status</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              title="Total Lease Expirations"
              value={expirations?.total || 0}
              subtitle="Across all properties"
              icon={FileText}
              variant="muted"
            />
            <SummaryCard
              title="Expiring Within 30 Days"
              value={highUrgency.length}
              subtitle="Require immediate follow-up"
              icon={AlertTriangle}
              variant={highUrgency.length > 0 ? 'danger' : 'default'}
            />
            <SummaryCard
              title="Upcoming Renewals (90 days)"
              value={renewals?.total || 0}
              subtitle="In renewal pipeline"
              icon={RefreshCw}
              variant="muted"
            />
          </>
        )}
      </div>

      {/* Section Label */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Intelligence & Actions</p>

      {/* Charts + Actions Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-10">
        <div className="xl:col-span-3 bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-text-muted">Urgency Distribution</h2>
              <p className="text-base font-semibold text-text-primary mt-0.5">Lease expirations by urgency level</p>
            </div>
            <TrendingUp size={16} className="text-text-muted" />
          </div>
          {loading ? (
            <div className="h-48 animate-pulse bg-surface-elevated rounded-lg" />
          ) : (
            <UrgencyChart
              high={highUrgency.length}
              medium={mediumUrgency.length}
              low={lowUrgency.length}
            />
          )}
        </div>

        <div className="xl:col-span-2">
          {loading ? (
            <div className="bg-surface border border-border rounded-xl p-6 h-full animate-pulse" />
          ) : (
            <ActionPanel
              highCount={highUrgency.length}
              mediumCount={mediumUrgency.length}
              renewalCount={renewals?.data.filter(r => r.renewal_status === 'pending').length || 0}
              declinedCount={renewals?.data.filter(r => r.renewal_status === 'declined').length || 0}
              notContactedCount={intelligence.leasesNotContacted.length}
              flaggedCount={intelligence.flaggedLeases.length}
              staleCount={intelligence.staleLeases.length}
            />
          )}
        </div>
      </div>

      {/* ── TASK METRICS ──────────────────────────────────────────────── */}
      {!loading && (
        <>
          {/* Section Label */}
          <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Work Queue</p>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-10">
            {/* Task Summary */}
            <div className="xl:col-span-2 bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center">
                    <CheckSquare size={14} className="text-accent" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Task Summary</h2>
                    <p className="text-xs text-text-muted">Open tasks by priority</p>
                  </div>
                </div>
                <Link
                  href="/tasks"
                  className="text-xs font-semibold tracking-wide uppercase text-accent hover:text-accent-muted transition-colors flex items-center gap-1"
                >
                  View All <ChevronRight size={12} />
                </Link>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-3 border-b border-border/60 mb-3">
                <span className="text-sm text-text-muted font-medium">Total Open Tasks</span>
                <span className="text-2xl font-bold text-text-primary">{openTasks.length}</span>
              </div>

              {/* Priority breakdown */}
              <div className="space-y-2.5">
                <Link href="/tasks" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-danger/10 border border-danger/20 hover:border-danger/40 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-danger flex-shrink-0" />
                    <span className="text-sm font-medium text-text-primary">High Priority</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-danger">{grouped.high.length}</span>
                    <ArrowRight size={13} className="text-danger opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>

                <Link href="/tasks" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/20 hover:border-warning/40 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                    <span className="text-sm font-medium text-text-primary">Medium Priority</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-warning">{grouped.medium.length}</span>
                    <ArrowRight size={13} className="text-warning opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>

                <Link href="/tasks" className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated border border-border hover:border-accent/30 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-text-muted flex-shrink-0" />
                    <span className="text-sm font-medium text-text-primary">Low Priority</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-text-muted">{grouped.low.length}</span>
                    <ArrowRight size={13} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Top Priorities Panel */}
            <div className="xl:col-span-3 bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-danger/15 flex items-center justify-center">
                    <Flame size={14} className="text-danger" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Top Priorities</h2>
                    <p className="text-xs text-text-muted">Highest-scoring open tasks</p>
                  </div>
                </div>
                <Link
                  href="/tasks"
                  className="text-xs font-semibold tracking-wide uppercase text-accent hover:text-accent-muted transition-colors flex items-center gap-1"
                >
                  View All <ChevronRight size={12} />
                </Link>
              </div>

              {topPriorities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckSquare size={28} className="text-accent mb-3 opacity-60" />
                  <p className="text-sm font-medium text-text-primary">No open tasks</p>
                  <p className="text-xs text-text-muted mt-1">All tasks are completed or no tasks generated.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topPriorities.map((task, idx) => {
                    const priorityColor =
                      task.priority === 'high' ? 'text-danger border-danger/30 bg-danger/5' :
                      task.priority === 'medium'? 'text-warning border-warning/30 bg-warning/5' : 'text-text-muted border-border bg-surface-elevated';
                    const rankColor = idx === 0 ? 'bg-danger text-white' : idx === 1 ? 'bg-warning text-white' : 'bg-surface-elevated text-text-muted';
                    const typeLabel = task.type === 'contact' ? 'Contact' : task.type === 'follow_up' ? 'Follow-Up' : 'Stale Check';
                    const unitLabel = task.lease.unit_number ? `Unit ${task.lease.unit_number}` : task.lease.property_name || task.lease_id;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 px-4 py-3.5 rounded-lg border ${priorityColor}`}
                      >
                        {/* Rank badge */}
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${rankColor}`}>
                          {idx + 1}
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-semibold text-text-primary truncate">{unitLabel}</span>
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border">{typeLabel}</span>
                          </div>
                          <p className="text-xs text-text-muted leading-snug">{task.reason}</p>
                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => handleQuickComplete(task.id)}
                              title="Mark Complete"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 hover:border-accent/40 transition-colors"
                            >
                              <Check size={11} />
                              Complete
                            </button>
                            <Link
                              href="/tasks"
                              title="Open in Tasks"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface-elevated text-text-muted border border-border hover:text-text-primary hover:border-accent/30 transition-colors"
                            >
                              <ExternalLink size={11} />
                              Tasks
                            </Link>
                            {task.lease.id && (
                              <Link
                                href={`/lease-expirations?lease=${task.lease.id}`}
                                title="Open Lease Details"
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface-elevated text-text-muted border border-border hover:text-text-primary hover:border-accent/30 transition-colors"
                              >
                                <FileText size={11} />
                                Lease
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Score */}
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

      {/* Section Label */}
      <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-3">Expiration Preview</p>

      {/* Lease Preview Table */}
      <div className="bg-surface border border-border rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-warning/15 flex items-center justify-center">
              <Zap size={14} className="text-warning" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Most Urgent Expirations</h2>
              <p className="text-xs text-text-muted">Sorted by urgency — top 6 requiring attention</p>
            </div>
          </div>
          <a href="/lease-expirations" className="text-xs font-semibold tracking-wide uppercase text-accent hover:text-accent-muted transition-colors">
            View All {expirations?.total ?? 0} →
          </a>
        </div>
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : (
          <LeaseTable leases={previewLeases} showActions={false} highlightUrgent showPagination={false} />
        )}
      </div>
    </div>
  );
}