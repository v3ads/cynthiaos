// ─── Task Engine (Frontend-Only) ──────────────────────────────────────────────
// Derives structured tasks from intelligence datasets.
// No backend — tasks are regenerated dynamically each render.
// Completion state is persisted in localStorage with rich records.

import { LeaseExpiration } from './api';
import { DerivedIntelligence } from './leaseIntelligence';
import { loadLeaseActions } from './leaseActions';

export type TaskType = 'contact' | 'follow_up' | 'stale_check';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'open' | 'completed';

export interface Task {
  id: string;
  lease_id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  /** ISO timestamp when the task was completed, or null if open */
  completed_at: string | null;
  /** The lease record this task is derived from */
  lease: LeaseExpiration;
  /** Human-readable reason this task was created */
  reason: string;
  /** Numeric priority score (higher = more urgent) */
  score: number;
}

// ─── Persisted completion record ─────────────────────────────────────────────

export interface TaskCompletionRecord {
  task_id: string;
  status: TaskStatus;
  completed_at: string;
}

// ─── Score weights ────────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  urgencyHigh: 50,    // days_until_expiration <= 7
  urgencyMedium: 30,  // days_until_expiration <= 30
  flagged: 20,
  notContacted: 25,
  stale: 15,
  oldAction: 10,      // last_action_at > 7 days ago (additional staleness bonus)
};

// ─── Score → Priority thresholds ─────────────────────────────────────────────

function scoreToPriority(score: number): TaskPriority {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ─── Score computation ────────────────────────────────────────────────────────

interface ScoreFactors {
  days: number;
  isFlagged: boolean;
  isNotContacted: boolean;
  isStale: boolean;
  lastActionAt: string | null;
}

function computeScore(factors: ScoreFactors): number {
  let score = 0;

  if (factors.days <= 7) {
    score += SCORE_WEIGHTS.urgencyHigh;
  } else if (factors.days <= 30) {
    score += SCORE_WEIGHTS.urgencyMedium;
  }

  if (factors.isFlagged) score += SCORE_WEIGHTS.flagged;
  if (factors.isNotContacted) score += SCORE_WEIGHTS.notContacted;
  if (factors.isStale) score += SCORE_WEIGHTS.stale;

  if (factors.lastActionAt) {
    const daysSinceAction = (Date.now() - new Date(factors.lastActionAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAction > 7) score += SCORE_WEIGHTS.oldAction;
  }

  return score;
}

// ─── Human-readable reason builder ───────────────────────────────────────────

function buildReason(priority: TaskPriority, factors: ScoreFactors): string {
  const parts: string[] = [];
  const days = factors.days;

  if (days <= 7) {
    parts.push(`expiring in ${days} day${days === 1 ? '' : 's'}`);
  } else if (days <= 30) {
    parts.push(`expiring in ${days} days`);
  }

  if (factors.isNotContacted) parts.push('not contacted');
  if (factors.isFlagged) parts.push('flagged for follow-up');
  if (factors.isStale) parts.push('no activity in 3+ days');

  if (parts.length === 0) {
    parts.push(`expires in ${days} days`);
  }

  const label = priority === 'high' ? 'High priority' : priority === 'medium' ? 'Medium' : 'Low priority';
  return `${label}: ${parts.join(' + ')}`;
}

// ─── localStorage persistence (rich records) ─────────────────────────────────

const COMPLETED_KEY = 'cynthiaos_completed_tasks_v2';

/** Load the completion map: task_id → TaskCompletionRecord */
function loadCompletionMap(): Map<string, TaskCompletionRecord> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    if (!raw) return new Map();
    const arr: TaskCompletionRecord[] = JSON.parse(raw);
    return new Map(arr.map(r => [r.task_id, r]));
  } catch {
    return new Map();
  }
}

function saveCompletionMap(map: Map<string, TaskCompletionRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...map.values()]));
  } catch {}
}

export function markTaskCompleted(taskId: string): void {
  const map = loadCompletionMap();
  map.set(taskId, {
    task_id: taskId,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  saveCompletionMap(map);
}

export function unmarkTaskCompleted(taskId: string): void {
  const map = loadCompletionMap();
  map.delete(taskId);
  saveCompletionMap(map);
}

/** Returns the full completion record for a task, or null if not completed */
export function getTaskCompletionRecord(taskId: string): TaskCompletionRecord | null {
  const map = loadCompletionMap();
  return map.get(taskId) ?? null;
}

/** @deprecated Use loadCompletionMap internally — kept for backward compat */
export function getCompletedTaskKeys(): Set<string> {
  return new Set(loadCompletionMap().keys());
}

function taskKey(leaseId: string, type: TaskType): string {
  return `${leaseId}::${type}`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a deduplicated list of tasks from derived intelligence.
 * Priority is computed via a scoring system using weighted factors.
 * Tasks are sorted by score (highest first) within each priority group.
 * Completion state (including completed_at) is persisted in localStorage.
 */
export function generateTasks(intelligence: DerivedIntelligence): Task[] {
  const completionMap = loadCompletionMap();
  const actionStore = loadLeaseActions();
  const seen = new Set<string>();
  const tasks: Task[] = [];

  const notContactedIds = new Set(intelligence.leasesNotContacted.map(l => l.id));
  const flaggedIds = new Set(intelligence.flaggedLeases.map(l => l.id));
  const staleIds = new Set(intelligence.staleLeases.map(l => l.id));

  const addTask = (lease: LeaseExpiration, type: TaskType) => {
    const key = taskKey(lease.id, type);
    if (seen.has(key)) return;
    seen.add(key);

    const actionRecord = actionStore[lease.id] ?? null;
    const factors: ScoreFactors = {
      days: lease.days_until_expiration,
      isFlagged: flaggedIds.has(lease.id),
      isNotContacted: notContactedIds.has(lease.id),
      isStale: staleIds.has(lease.id),
      lastActionAt: actionRecord?.last_action_at ?? null,
    };

    let score = computeScore(factors);
    const priority = scoreToPriority(score);
    const reason = buildReason(priority, factors);

    const completionRecord = completionMap.get(key) ?? null;
    const status: TaskStatus = completionRecord ? 'completed' : 'open';

    tasks.push({
      id: key,
      lease_id: lease.id,
      type,
      priority,
      status,
      created_at: new Date().toISOString(),
      completed_at: completionRecord?.completed_at ?? null,
      lease,
      reason,
      score,
    });
  };

  intelligence.leasesNotContacted.forEach(l => addTask(l, 'contact'));
  intelligence.flaggedLeases.forEach(l => addTask(l, 'follow_up'));
  intelligence.staleLeases.forEach(l => addTask(l, 'stale_check'));

  const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  tasks.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
    return b.score - a.score;
  });

  return tasks;
}

/** Group tasks by priority for display */
export function groupTasksByPriority(tasks: Task[]): Record<TaskPriority, Task[]> {
  return {
    high: tasks.filter(t => t.priority === 'high'),
    medium: tasks.filter(t => t.priority === 'medium'),
    low: tasks.filter(t => t.priority === 'low'),
  };
}
