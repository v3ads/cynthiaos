export type UrgencyLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export function getUrgencyLevel(daysUntilExpiration: number): UrgencyLevel {
  if (daysUntilExpiration <= 30) return 'HIGH';
  if (daysUntilExpiration <= 60) return 'MEDIUM';
  return 'LOW';
}

export const URGENCY_CONFIG = {
  HIGH: {
    label: 'High',
    textClass: 'text-danger',
    bgClass: 'bg-danger-bg',
    borderClass: 'border-danger/30',
    dotClass: 'bg-danger',
    badgeClass: 'bg-danger/15 text-danger border border-danger/30',
    rowClass: 'bg-danger/5',
  },
  MEDIUM: {
    label: 'Medium',
    textClass: 'text-warning',
    bgClass: 'bg-warning-bg',
    borderClass: 'border-warning/30',
    dotClass: 'bg-warning',
    badgeClass: 'bg-warning/15 text-warning border border-warning/30',
    rowClass: 'bg-warning/5',
  },
  LOW: {
    label: 'Low',
    textClass: 'text-accent',
    bgClass: 'bg-accent-bg',
    borderClass: 'border-accent/30',
    dotClass: 'bg-accent',
    badgeClass: 'bg-accent/15 text-accent border border-accent/30',
    rowClass: '',
  },
} as const;