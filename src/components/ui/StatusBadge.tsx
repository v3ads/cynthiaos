import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant: 'danger' | 'warning' | 'success' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const VARIANT_CLASSES = {
  danger: 'bg-danger/15 text-danger border border-danger/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  success: 'bg-accent/15 text-accent border border-accent/30',
  info: 'bg-info/15 text-info border border-info/30',
  neutral: 'bg-surface-elevated text-text-secondary border border-border',
};

const DOT_CLASSES = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-accent',
  info: 'bg-info',
  neutral: 'bg-text-muted',
};

export default function StatusBadge({ label, variant, size = 'sm', dot = false }: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} ${VARIANT_CLASSES[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_CLASSES[variant]}`} />}
      {label}
    </span>
  );
}