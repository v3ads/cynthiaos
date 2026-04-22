'use client';

import React from 'react';
import { LeaseExpiration } from '@/lib/api';
import { getUrgencyLevel, URGENCY_CONFIG } from '@/lib/urgency';
import StatusBadge from './StatusBadge';
import { Phone, Mail, Eye, CheckCircle2, Flag } from 'lucide-react';

interface LeaseTableProps {
  leases: LeaseExpiration[];
  showActions?: boolean;
  compact?: boolean;
  highlightUrgent?: boolean;
  showPagination?: boolean;
  onViewDetails?: (lease: LeaseExpiration) => void;
  contactedIds?: Set<string>;
  flaggedIds?: Set<string>;
  onMarkContacted?: (lease: LeaseExpiration) => void;
  onFlagFollowUp?: (lease: LeaseExpiration) => void;
}

export default function LeaseTable({
  leases,
  showActions = true,
  compact = false,
  highlightUrgent = false,
  showPagination = true,
  onViewDetails,
  contactedIds,
  flaggedIds,
  onMarkContacted,
  onFlagFollowUp,
}: LeaseTableProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatRent = (amount: number) =>
    amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount) : '—';

  if (leases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center mb-4">
          <Mail size={22} className="text-text-muted" />
        </div>
        <p className="text-text-primary font-medium">No leases found</p>
        <p className="text-text-secondary text-sm mt-1">Try adjusting your filters to see results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Tenant</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Unit</th>
            {!compact && <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Property</th>}
            <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Lease End</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Days Left</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Urgency</th>
            {!compact && <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Monthly Rent</th>}
            {!compact && <th className="text-left px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Type</th>}
            {showActions && !compact && <th className="text-right px-4 py-3 text-xs font-semibold text-accent/80 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {leases.map(lease => {
            const urgency = getUrgencyLevel(lease.days_until_expiration);
            const config = URGENCY_CONFIG[urgency];
            const badgeVariant = urgency === 'HIGH' ? 'danger' : urgency === 'MEDIUM' ? 'warning' : 'success';
            const isHighUrgent = highlightUrgent && urgency === 'HIGH';
            const isContacted = contactedIds?.has(lease.id) ?? false;
            const isFlagged = flaggedIds?.has(lease.id) ?? false;

            const isFamily = !!lease.unit_group;
            const familyLabel = lease.unit_group
              ? lease.unit_group.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              : null;

            return (
              <tr
                key={lease.id}
                className={`hover:bg-surface-elevated/50 transition-colors group ${
                  isHighUrgent ? 'bg-danger/8 border-l-2 border-l-danger' : isFamily ? 'border-l-2 border-l-teal-500/50' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${isHighUrgent ? 'bg-danger/20 text-danger' : 'bg-surface-elevated text-text-secondary'}`}>
                      {lease.tenant_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className={`font-medium ${isHighUrgent ? 'text-text-primary font-semibold' : 'text-text-primary'}`}>{lease.tenant_name}</p>
                        {isContacted && <CheckCircle2 size={12} className="text-accent flex-shrink-0" title="Contacted" />}
                        {isFlagged && <Flag size={12} className="text-warning flex-shrink-0" title="Flagged for follow-up" />}
                        {isFamily && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-teal-500/10 text-teal-400 border-teal-500/25">
                            👪 {familyLabel}
                          </span>
                        )}
                      </div>
                      {!compact && <p className="text-xs text-text-secondary">{lease.contact_email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-text-secondary text-xs">{lease.unit}</td>
                {!compact && <td className="px-4 py-3 text-text-secondary">{lease.property}</td>}
                <td className="px-4 py-3 text-text-secondary tabular-nums">{formatDate(lease.lease_end_date)}</td>
                <td className="px-4 py-3">
                  <span className={`tabular-nums font-semibold ${config.textClass}`}>{lease.days_until_expiration}d</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={config.label} variant={badgeVariant} dot />
                </td>
                {!compact && <td className="px-4 py-3 tabular-nums text-text-secondary">{formatRent(lease.monthly_rent)}</td>}
                {!compact && <td className="px-4 py-3 text-text-muted text-xs">{lease.lease_type}</td>}
                {showActions && !compact && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* View Details */}
                      {onViewDetails && (
                        <button
                          onClick={() => onViewDetails(lease)}
                          title="View Details"
                          className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      {/* Mark as Contacted */}
                      {onMarkContacted && (
                        <button
                          onClick={() => onMarkContacted(lease)}
                          title={isContacted ? 'Contacted' : 'Mark as Contacted'}
                          className={`p-1.5 rounded-md transition-colors ${isContacted ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-accent hover:bg-accent/10'}`}
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {/* Flag for Follow-up */}
                      {onFlagFollowUp && (
                        <button
                          onClick={() => onFlagFollowUp(lease)}
                          title={isFlagged ? 'Flagged' : 'Flag for Follow-up'}
                          className={`p-1.5 rounded-md transition-colors ${isFlagged ? 'text-warning bg-warning/10' : 'text-text-muted hover:text-warning hover:bg-warning/10'}`}
                        >
                          <Flag size={14} />
                        </button>
                      )}
                      {/* Legacy phone/email quick actions */}
                      <a
                        href={`tel:${lease.contact_phone}`}
                        title={`Call ${lease.tenant_name}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                      >
                        <Phone size={14} />
                      </a>
                      <a
                        href={`mailto:${encodeURIComponent(lease.contact_email ?? '')}?bcc=${encodeURIComponent('leasing@cynthiagardens.com')}`}
                        title={`Email ${lease.tenant_name}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                      >
                        <Mail size={14} />
                      </a>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}