'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  Circle,
  CheckCircle2,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Flag,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LeaseExpiration } from '@/lib/api';
import { computeDerivedIntelligence } from '@/lib/leaseIntelligence';
import {
  Task,
  TaskPriority,
  TaskType,
  generateTasks,
  groupTasksByPriority,
} from '@/lib/taskEngine';
import LeaseDetailDrawer from '@/components/ui/LeaseDetailDrawer';
import { useLeaseActions } from '@/contexts/LeaseActionsContext';

interface TasksContentProps {
  leases: LeaseExpiration[];
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; dotClass: string; headerClass: string; countClass: string }
> = {
  high: {
    label: 'High Priority',
    dotClass: 'bg-red-500',
    headerClass: 'text-red-400',
    countClass: 'bg-red-500/15 text-red-400',
  },
  medium: {
    label: 'Medium Priority',
    dotClass: 'bg-yellow-500',
    headerClass: 'text-yellow-400',
    countClass: 'bg-yellow-500/15 text-yellow-400',
  },
  low: {
    label: 'Low Priority',
    dotClass: 'bg-blue-500',
    headerClass: 'text-blue-400',
    countClass: 'bg-blue-500/15 text-blue-400',
  },
};

const TYPE_CONFIG: Record<TaskType, { label: string; icon: React.ReactNode }> = {
  contact: {
    label: 'First Contact',
    icon: <Phone size={12} className="text-accent" />,
  },
  follow_up: {
    label: 'Follow-Up',
    icon: <Flag size={12} className="text-yellow-400" />,
  },
  stale_check: {
    label: 'Stale Check',
    icon: <Clock size={12} className="text-orange-400" />,
  },
};

type SortOption = 'score_desc' | 'newest' | 'oldest' | 'recently_completed';

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onComplete: (task: Task) => void;
  onOpenDrawer: (lease: LeaseExpiration) => void;
  onQuickContact: (task: Task) => void;
}

function TaskCard({ task, onComplete, onOpenDrawer, onQuickContact }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const typeConf = TYPE_CONFIG[task.type];

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 rounded-lg border transition-all ${
        isCompleted
          ? 'border-border/30 bg-surface/40 opacity-60' :'border-border/50 bg-surface hover:border-border hover:bg-surface-elevated'
      }`}
    >
      {/* Complete toggle */}
      <button
        onClick={() => onComplete(task)}
        className="mt-0.5 flex-shrink-0 text-text-muted hover:text-accent transition-colors"
        aria-label={isCompleted ? 'Mark open' : 'Mark complete'}
      >
        {isCompleted ? (
          <CheckCircle2 size={18} className="text-accent" />
        ) : (
          <Circle size={18} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="flex items-center gap-1 text-xs font-medium text-text-muted">
            {typeConf.icon}
            {typeConf.label}
          </span>
        </div>
        <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {task.lease.tenant_name}
        </p>
        <p className="text-xs text-text-muted truncate mt-0.5">
          {task.lease.unit} · {task.lease.property}
        </p>
        <p className="text-xs text-text-muted/70 mt-1 leading-relaxed">{task.reason}</p>
        {isCompleted && task.completed_at && (
          <p className="text-xs text-accent/60 mt-1">
            Completed {new Date(task.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
            at {new Date(task.completed_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onQuickContact(task)}
            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Quick contact"
          >
            <Mail size={14} />
          </button>
          <button
            onClick={() => onOpenDrawer(task.lease)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors"
            title="Open lease drawer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Priority Group ───────────────────────────────────────────────────────────

interface PriorityGroupProps {
  priority: TaskPriority;
  tasks: Task[];
  onComplete: (task: Task) => void;
  onOpenDrawer: (lease: LeaseExpiration) => void;
  onQuickContact: (task: Task) => void;
}

function PriorityGroup({ priority, tasks, onComplete, onOpenDrawer, onQuickContact }: PriorityGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const conf = PRIORITY_CONFIG[priority];
  const openCount = tasks.filter(t => t.status === 'open').length;

  if (tasks.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-1 py-2 text-left group"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${conf.dotClass}`} />
        <span className={`text-xs font-semibold uppercase tracking-widest ${conf.headerClass}`}>
          {conf.label}
        </span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${conf.countClass}`}>
          {openCount} open
        </span>
        <span className="ml-auto text-text-muted/50 group-hover:text-text-muted transition-colors">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1.5 mt-1">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onOpenDrawer={onOpenDrawer}
              onQuickContact={onQuickContact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksContent({ leases }: TasksContentProps) {
  const { store: actionStore, updateAction } = useLeaseActions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drawerLease, setDrawerLease] = useState<LeaseExpiration | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('open');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('score_desc');
  const [showFilters, setShowFilters] = useState(false);

  const regenerate = useCallback(() => {
    const intelligence = computeDerivedIntelligence(leases);
    const generated = generateTasks(intelligence, actionStore);
    setTasks(generated);
  }, [leases, actionStore]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const handleComplete = async (task: Task) => {
    if (task.type === 'contact' || task.type === 'stale_check') {
      // Toggle contacted in DB — task completion is derived from this
      const current = actionStore[task.lease_id]?.contacted ?? false;
      await updateAction(task.lease_id, { contacted: !current });
    } else if (task.type === 'follow_up') {
      // Toggle flagged in DB
      const current = actionStore[task.lease_id]?.flagged ?? false;
      await updateAction(task.lease_id, { flagged: !current });
    }
    // regenerate() will be called automatically via actionStore change in useEffect
  };

  const handleQuickContact = (task: Task) => {
    const email = task.lease.contact_email;
    if (email) {
      const to      = encodeURIComponent(email);
      const subject = encodeURIComponent(`Lease Renewal - ${task.lease.unit}`);
      window.location.href = `mailto:${to}?bcc=${encodeURIComponent('leasing@cynthiagardens.com')}&subject=${subject}`;
    }
  };

  // Derived: apply status tab, search, priority filter, type filter, then sort
  const processedTasks = useMemo(() => {
    let result = tasks.filter(t => {
      if (filter === 'open') return t.status === 'open';
      if (filter === 'completed') return t.status === 'completed';
      return true;
    });

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(t =>
        t.lease.tenant_name?.toLowerCase().includes(q) ||
        t.lease.unit?.toLowerCase().includes(q) ||
        TYPE_CONFIG[t.type].label.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      );
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortOption === 'score_desc') {
        // Keep priority grouping intact, sort by score within group
        const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
        return b.score - a.score;
      }
      if (sortOption === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === 'recently_completed') {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return bTime - aTime;
      }
      return 0;
    });

    return result;
  }, [tasks, filter, searchQuery, priorityFilter, typeFilter, sortOption]);

  const grouped = groupTasksByPriority(processedTasks);

  const openCount = tasks.filter(t => t.status === 'open').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;

  const isEmpty = processedTasks.length === 0;

  const hasActiveFilters = searchQuery.trim() !== '' || priorityFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setTypeFilter('all');
    setSortOption('score_desc');
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-5 pt-14 lg:pt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Intelligence</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Tasks</h1>
            <p className="text-sm text-text-secondary mt-1">
              {openCount} open · {completedCount} completed · {totalCount} total
            </p>
          </div>
          <button
            onClick={regenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-surface-elevated border border-border/50 transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-border/30">
        {(['open', 'completed', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-accent/15 text-accent' :'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            {f === 'open' ? `Open (${openCount})` : f === 'completed' ? `Completed (${completedCount})` : `All (${totalCount})`}
          </button>
        ))}
      </div>

      {/* Search + Filter toolbar */}
      <div className="px-6 pt-3 pb-2 space-y-2">
        {/* Search row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by tenant, unit, or task type…"
              className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-surface border border-border/50 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors flex-shrink-0 ${
              showFilters || hasActiveFilters
                ? 'bg-accent/15 text-accent border-accent/30' :'text-text-muted border-border/50 hover:text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
            )}
          </button>
        </div>

        {/* Expanded filter controls */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Priority filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-muted/70 mr-0.5">Priority:</span>
              {(['all', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    priorityFilter === p
                      ? p === 'high' ?'bg-red-500/20 text-red-400'
                        : p === 'medium' ?'bg-yellow-500/20 text-yellow-400'
                        : p === 'low' ?'bg-blue-500/20 text-blue-400' :'bg-accent/15 text-accent' :'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-border/40 mx-1" />

            {/* Type filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-muted/70 mr-0.5">Type:</span>
              {(['all', 'contact', 'follow_up', 'stale_check'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-accent/15 text-accent' :'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'contact' ? 'Contact' : t === 'follow_up' ? 'Follow-up' : 'Stale Check'}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-border/40 mx-1" />

            {/* Sort */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-muted/70 mr-0.5">Sort:</span>
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value as SortOption)}
                className="bg-surface border border-border/50 text-xs text-text-primary rounded-md px-2 py-1 focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
              >
                <option value="score_desc">Highest score first</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="recently_completed">Recently completed</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                <X size={11} />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Active filter summary */}
        {hasActiveFilters && !showFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {searchQuery.trim() && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border/50 text-xs text-text-secondary">
                "{searchQuery.trim()}"
                <button onClick={() => setSearchQuery('')} className="hover:text-text-secondary transition-colors">
                  <X size={10} />
                </button>
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border/50 text-xs text-text-muted capitalize">
                {priorityFilter} priority
                <button onClick={() => setPriorityFilter('all')} className="hover:text-text-secondary transition-colors">
                  <X size={10} />
                </button>
              </span>
            )}
            {typeFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border/50 text-xs text-text-secondary">
                {typeFilter === 'contact' ? 'Contact' : typeFilter === 'follow_up' ? 'Follow-up' : 'Stale Check'}
                <button onClick={() => setTypeFilter('all')} className="hover:text-text-secondary transition-colors">
                  <X size={10} />
                </button>
              </span>
            )}
            <button onClick={clearFilters} className="text-xs text-text-muted/60 hover:text-text-muted transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 px-6 py-4 overflow-y-auto">
        {leases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center mb-4">
              <AlertTriangle size={20} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">Loading lease data…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
              <CheckSquare size={20} className="text-accent" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">
              {hasActiveFilters ? 'No tasks match your filters' : filter === 'completed' ? 'No completed tasks yet' : 'All caught up!'}
            </p>
            <p className="text-xs text-text-secondary">
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : filter === 'completed' ?'Complete tasks to see them here.' :'No open tasks derived from current intelligence.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <PriorityGroup
              priority="high"
              tasks={grouped.high}
              onComplete={handleComplete}
              onOpenDrawer={setDrawerLease}
              onQuickContact={handleQuickContact}
            />
            <PriorityGroup
              priority="medium"
              tasks={grouped.medium}
              onComplete={handleComplete}
              onOpenDrawer={setDrawerLease}
              onQuickContact={handleQuickContact}
            />
            <PriorityGroup
              priority="low"
              tasks={grouped.low}
              onComplete={handleComplete}
              onOpenDrawer={setDrawerLease}
              onQuickContact={handleQuickContact}
            />
          </>
        )}
      </div>

      {/* Lease Detail Drawer */}
      <LeaseDetailDrawer
        lease={drawerLease}
        onClose={() => setDrawerLease(null)}
      />
    </div>
  );
}
