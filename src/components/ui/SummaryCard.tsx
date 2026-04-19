import React from 'react';
import { LucideIcon } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'muted';
  trend?: { value: string; positive: boolean };
}

const VARIANT_STYLES = {
  default: {
    iconBg: 'bg-surface-elevated',
    iconColor: 'text-text-secondary',
    border: 'border-border',
    valueColor: 'text-text-primary',
    topBar: '',
    opacity: '',
  },
  muted: {
    iconBg: 'bg-surface-elevated',
    iconColor: 'text-text-secondary',
    border: 'border-border/50',
    valueColor: 'text-text-secondary',
    topBar: '',
    opacity: 'opacity-70',
  },
  danger: {
    iconBg: 'bg-danger/15',
    iconColor: 'text-danger',
    border: 'border-danger/35',
    valueColor: 'text-danger',
    topBar: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-danger before:rounded-t-xl',
    opacity: '',
  },
  warning: {
    iconBg: 'bg-warning/15',
    iconColor: 'text-warning',
    border: 'border-warning/35',
    valueColor: 'text-warning',
    topBar: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-warning before:rounded-t-xl',
    opacity: '',
  },
  success: {
    iconBg: 'bg-accent/15',
    iconColor: 'text-accent',
    border: 'border-accent/30',
    valueColor: 'text-accent',
    topBar: '',
    opacity: '',
  },
};

export default function SummaryCard({ title, value, subtitle, icon: Icon, variant = 'default', trend }: SummaryCardProps) {
  const styles = VARIANT_STYLES[variant];
  return (
    <div className={`relative bg-surface rounded-xl border ${styles.border} p-5 flex flex-col gap-4 ${styles.topBar} ${styles.opacity}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={styles.iconColor} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend.positive ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className={`text-4xl font-bold tabular-nums tracking-tight ${styles.valueColor}`}>{value}</p>
        <p className="text-sm font-semibold text-text-secondary mt-1">{title}</p>
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}