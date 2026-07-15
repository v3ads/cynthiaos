'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  X,
  RefreshCw,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import {
  getActions,
  transitionAction,
  createAction,
  ActionItem,
} from '@/lib/api';

type TabFilter = 'open' | 'completed' | 'all';

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };
const PRIORITY_LABEL: Record<string, string> = { high: 'High priority', normal: 'Standard', low: 'Low priority' };
const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-danger',
  normal: 'border-l-accent',
  low: 'border-l-border',
};

const TYPE_LABEL: Record<string, string> = {
  renewal_due: 'Renewal',
  holdover: 'Holdover',
  stale_closeout: 'Lease closeout',
  overdue_turn: 'Turn',
  broken_promise: 'Collections',
  no_recent_contact: 'Contact',
  ad_hoc: 'Task',
};

function ActionRow({
  a,
  onTransition,
}: {
  a: ActionItem;
  onTransition: (id: string, status: string) => void;
}) {
  const done = a.status === 'done' || a.status === 'dismissed';
  return (
    <div
      className={`bg-surface border border-border/50 border-l-2 ${
        done ? 'border-l-border opacity-60' : PRIORITY_BORDER[a.priority] ?? 'border-l-border'
      } rounded-lg p-3.5 flex items-start gap-3`}
    >
      <button
        onClick={() => onTransition(a.action_id, done ? 'open' : 'done')}
        className="mt-0.5 flex-shrink-0"
        aria-label={done ? 'Reopen' : 'Mark done'}
      >
        {done ? (
          <CheckCircle2 size={18} className="text-accent" />
        ) : (
          <Circle size={18} className="text-text-muted hover:text-accent transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
            {a.title}
          </p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border/50">
            {TYPE_LABEL[a.type] ?? a.type}
          </span>
          {a.impact_label && !done && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25">
              {a.impact_label}
            </span>
          )}
          {a.due_at && !done && (
            <span className="text-[10px] text-text-muted">
              due {new Date(a.due_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {a.detail && !done && (
          <p className="text-xs text-text-secondary mt-1 leading-snug">{a.detail}</p>
        )}
        {a.next_action && !done && (
          <p className="text-[11px] text-accent mt-1.5">→ {a.next_action}</p>
        )}
        <p className="text-[10px] text-text-muted mt-1.5">Owner: {a.owner}</p>
      </div>

      {!done && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onTransition(a.action_id, 'snoozed')}
            title="Snooze 7 days"
            className="p-1.5 rounded-md hover:bg-warning/10 text-text-muted hover:text-warning transition-colors"
          >
            <Clock size={14} />
          </button>
          <button
            onClick={() => onTransition(a.action_id, 'dismissed')}
            title="Dismiss"
            className="p-1.5 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function TasksContent() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tab, setTab] = useState<TabFilter>('open');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 'all' fetches both universes; open/completed filter client-side so
      // switching tabs is instant.
      const { data } = await getActions({ status: 'all' });
      setActions(data);
      setHasLoaded(true);
    } catch (e) {
      console.error('Tasks load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTransition = useCallback(
    async (id: string, status: string) => {
      setActions((prev) =>
        prev.map((a) => (a.action_id === id ? { ...a, status: status as ActionItem['status'] } : a))
      );
      try {
        const snoozed_until =
          status === 'snoozed'
            ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
            : undefined;
        await transitionAction(id, { status, snoozed_until });
        if (status === 'snoozed' || status === 'dismissed') {
          // These leave the open list; refresh to reconcile ordering.
          setActions((prev) => prev.filter((a) => a.action_id !== id));
        }
      } catch (e) {
        console.error('Transition failed:', e);
        load();
      }
    },
    [load]
  );

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    setAdding(false);
    const optimistic: ActionItem = {
      action_id: `temp-${Date.now()}`,
      natural_key: null,
      source: 'user',
      type: 'ad_hoc',
      entity_type: null,
      entity_id: null,
      title,
      detail: null,
      owner: 'Cindy',
      priority: 'normal',
      status: 'open',
      due_at: null,
      impact_label: null,
      next_action: null,
      confidence: 'trusted',
    };
    setActions((prev) => [optimistic, ...prev]);
    try {
      const created = await createAction({ title });
      setActions((prev) => prev.map((a) => (a.action_id === optimistic.action_id ? created : a)));
    } catch (e) {
      console.error('Create task failed:', e);
      setActions((prev) => prev.filter((a) => a.action_id !== optimistic.action_id));
    }
  }, [newTitle]);

  const { open, completed } = useMemo(() => {
    const isDone = (a: ActionItem) => a.status === 'done' || a.status === 'dismissed';
    return {
      open: actions.filter((a) => a.status === 'open' || a.status === 'in_progress'),
      completed: actions.filter(isDone),
    };
  }, [actions]);

  const visible = tab === 'open' ? open : tab === 'completed' ? completed : actions;

  const grouped = useMemo(() => {
    const sorted = [...visible].sort((a, b) => {
      const p = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      if (p !== 0) return p;
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      return a.due_at ? -1 : b.due_at ? 1 : 0;
    });
    if (tab === 'completed') return { '': sorted };
    return sorted.reduce<Record<string, ActionItem[]>>((acc, a) => {
      (acc[a.priority] ??= []).push(a);
      return acc;
    }, {});
  }, [visible, tab]);

  return (
    <div className="min-h-screen p-6 pt-16 lg:pt-10 lg:p-10 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between mb-3 pb-6 border-b border-border/60">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-1.5">Worklist</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Tasks</h1>
          <p className="text-text-secondary text-sm mt-1.5">
            {open.length} open · {completed.length} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-white bg-accent rounded-lg px-3 py-2 hover:bg-accent/90"
          >
            <Plus size={13} /> Add task
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2 hover:border-accent/40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-6">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="What needs doing?"
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-accent text-white disabled:bg-surface-elevated disabled:text-text-muted"
          >
            Add
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6">
        {(
          [
            ['open', `Open (${open.length})`],
            ['completed', `Done (${completed.length})`],
            ['all', `All (${actions.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              tab === key
                ? 'bg-accent/15 text-accent border-accent/30'
                : 'border-border/50 text-text-muted hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !hasLoaded ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-surface border border-border rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 size={28} className="text-accent mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">
            {tab === 'completed' ? 'Nothing completed yet' : 'All clear'}
          </p>
          <p className="text-xs text-text-muted">
            {tab === 'completed' ? 'Finished tasks will appear here.' : 'No open tasks right now.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([priority, items]) =>
            items.length === 0 ? null : (
              <div key={priority || 'done'}>
                {priority && tab !== 'completed' && (
                  <div className="flex items-center gap-2 mb-2">
                    {priority === 'high' && <AlertTriangle size={12} className="text-danger" />}
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                      {PRIORITY_LABEL[priority] ?? priority} · {items.length}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {items.map((a) => (
                    <ActionRow key={a.action_id} a={a} onTransition={handleTransition} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
