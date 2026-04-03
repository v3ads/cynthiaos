import React from 'react';
import { AlertTriangle, Clock, XCircle, CheckCircle2, ArrowRight, PhoneMissed, Flag, Timer } from 'lucide-react';
import Link from 'next/link';

interface ActionPanelProps {
  highCount: number;
  mediumCount: number;
  renewalCount: number;
  declinedCount: number;
  // Derived intelligence counts
  notContactedCount?: number;
  flaggedCount?: number;
  staleCount?: number;
}

interface ActionItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  hoverBg: string;
  text: string;
  subtext: string;
  href: string;
  tier: 'immediate' | 'soon' | 'pipeline';
}

export default function ActionPanel({
  highCount,
  mediumCount,
  renewalCount,
  declinedCount,
  notContactedCount = 0,
  flaggedCount = 0,
  staleCount = 0,
}: ActionPanelProps) {
  const allActions: ActionItem[] = [
    ...(highCount > 0 ? [{
      id: 'action-high',
      icon: AlertTriangle,
      iconColor: 'text-danger',
      iconBg: 'bg-danger/15',
      borderColor: 'border-danger/40',
      hoverBg: 'hover:bg-danger/10 hover:border-danger/60 hover:shadow-sm hover:shadow-danger/10',
      text: `${highCount} lease${highCount > 1 ? 's' : ''} require immediate follow-up`,
      subtext: 'Expiring within 30 days — contact now',
      href: '/leases-expiring-soon',
      tier: 'immediate' as const,
    }] : []),
    ...(declinedCount > 0 ? [{
      id: 'action-declined',
      icon: XCircle,
      iconColor: 'text-danger',
      iconBg: 'bg-danger/15',
      borderColor: 'border-danger/40',
      hoverBg: 'hover:bg-danger/10 hover:border-danger/60 hover:shadow-sm hover:shadow-danger/10',
      text: `${declinedCount} renewal${declinedCount > 1 ? 's' : ''} declined — vacancy risk`,
      subtext: 'Begin re-leasing process immediately',
      href: '/upcoming-renewals',
      tier: 'immediate' as const,
    }] : []),
    ...(notContactedCount > 0 ? [{
      id: 'action-not-contacted',
      icon: PhoneMissed,
      iconColor: 'text-danger',
      iconBg: 'bg-danger/15',
      borderColor: 'border-danger/40',
      hoverBg: 'hover:bg-danger/10 hover:border-danger/60 hover:shadow-sm hover:shadow-danger/10',
      text: `${notContactedCount} lease${notContactedCount > 1 ? 's' : ''} need first contact`,
      subtext: 'Urgent leases with no outreach yet',
      href: '/leases-expiring-soon',
      tier: 'immediate' as const,
    }] : []),
    ...(flaggedCount > 0 ? [{
      id: 'action-flagged',
      icon: Flag,
      iconColor: 'text-warning',
      iconBg: 'bg-warning/15',
      borderColor: 'border-warning/35',
      hoverBg: 'hover:bg-warning/8 hover:border-warning/55 hover:shadow-sm hover:shadow-warning/10',
      text: `${flaggedCount} lease${flaggedCount > 1 ? 's' : ''} flagged for follow-up`,
      subtext: 'Review flagged items and take action',
      href: '/lease-expirations',
      tier: 'soon' as const,
    }] : []),
    ...(staleCount > 0 ? [{
      id: 'action-stale',
      icon: Timer,
      iconColor: 'text-warning',
      iconBg: 'bg-warning/15',
      borderColor: 'border-warning/35',
      hoverBg: 'hover:bg-warning/8 hover:border-warning/55 hover:shadow-sm hover:shadow-warning/10',
      text: `${staleCount} lease${staleCount > 1 ? 's' : ''} not touched in 3+ days`,
      subtext: 'Re-engage before they fall through the cracks',
      href: '/lease-expirations',
      tier: 'soon' as const,
    }] : []),
    ...(mediumCount > 0 ? [{
      id: 'action-medium',
      icon: Clock,
      iconColor: 'text-warning',
      iconBg: 'bg-warning/15',
      borderColor: 'border-warning/35',
      hoverBg: 'hover:bg-warning/8 hover:border-warning/55 hover:shadow-sm hover:shadow-warning/10',
      text: `${mediumCount} lease${mediumCount > 1 ? 's' : ''} expiring in 31–60 days`,
      subtext: 'Schedule renewal conversations this week',
      href: '/leases-expiring-soon',
      tier: 'soon' as const,
    }] : []),
    ...(renewalCount > 0 ? [{
      id: 'action-renewals',
      icon: CheckCircle2,
      iconColor: 'text-accent',
      iconBg: 'bg-accent/15',
      borderColor: 'border-accent/25',
      hoverBg: 'hover:bg-accent/8 hover:border-accent/45 hover:shadow-sm hover:shadow-accent/10',
      text: `${renewalCount} renewal offer${renewalCount > 1 ? 's' : ''} awaiting response`,
      subtext: 'Follow up with tenants on pending offers',
      href: '/upcoming-renewals',
      tier: 'pipeline' as const,
    }] : []),
  ];

  const immediate = allActions.filter(a => a.tier === 'immediate');
  const soon = allActions.filter(a => a.tier === 'soon');
  const pipeline = allActions.filter(a => a.tier === 'pipeline');

  const tierConfig = {
    immediate: { label: 'Immediate', dotColor: 'bg-danger', textColor: 'text-danger' },
    soon: { label: 'Soon', dotColor: 'bg-warning', textColor: 'text-warning' },
    pipeline: { label: 'Pipeline', dotColor: 'bg-accent', textColor: 'text-accent' },
  };

  const renderTier = (actions: ActionItem[], tier: 'immediate' | 'soon' | 'pipeline') => {
    if (actions.length === 0) return null;
    const cfg = tierConfig[tier];
    return (
      <div className="mb-3 last:mb-0">
        <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} flex-shrink-0`} />
          <span className={`text-xs font-semibold tracking-widest uppercase ${cfg.textColor}`}>{cfg.label}</span>
        </div>
        <div className="space-y-1.5">
          {actions.map(action => (
            <Link
              key={action.id}
              href={action.href}
              className={`flex items-start gap-3 p-3.5 rounded-lg bg-surface-elevated border ${action.borderColor} ${action.hoverBg} transition-all duration-150 group cursor-pointer`}
            >
              <div className={`w-8 h-8 rounded-lg ${action.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <action.icon size={15} className={action.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary leading-snug">{action.text}</p>
                <p className="text-xs text-text-muted mt-0.5">{action.subtext}</p>
              </div>
              <ArrowRight size={14} className={`${action.iconColor} opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 mt-1 flex-shrink-0 transition-all duration-150`} />
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 h-full flex flex-col">
      <div className="mb-5">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-text-muted">Recommended Actions</h2>
        <p className="text-base font-semibold text-text-primary mt-0.5">
          {allActions.length > 0 ? `${allActions.length} item${allActions.length > 1 ? 's' : ''} need attention` : 'All systems clear'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {allActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
              <CheckCircle2 size={22} className="text-accent" />
            </div>
            <p className="text-text-secondary font-semibold text-sm">All caught up</p>
            <p className="text-text-muted text-xs mt-1">No urgent actions required today.</p>
          </div>
        ) : (
          <>
            {renderTier(immediate, 'immediate')}
            {renderTier(soon, 'soon')}
            {renderTier(pipeline, 'pipeline')}
          </>
        )}
      </div>
    </div>
  );
}