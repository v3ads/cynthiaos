'use client';

import React, { useState, useEffect } from 'react';
import { LeaseExpiration } from '@/lib/api';
import { getUrgencyLevel, URGENCY_CONFIG } from '@/lib/urgency';
import StatusBadge from './StatusBadge';
import { X, Phone, Mail, CheckCircle2, Circle, StickyNote, User, Home, Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getLeaseAction,
  updateLeaseAction,
  mergeApiRecord,
  formatActionTimestamp,
  LeaseActionRecord,
} from '@/lib/leaseActions';
import { getLeaseActionsFromApi, putLeaseActionsToApi } from '@/lib/api';

interface LeaseDetailDrawerProps {
  lease: LeaseExpiration | null;
  onClose: () => void;
  /** Called after any action so parent can refresh contactedIds / flaggedIds */
  onActionUpdate?: (leaseId: string, record: LeaseActionRecord) => void;
}

export default function LeaseDetailDrawer({ lease, onClose, onActionUpdate }: LeaseDetailDrawerProps) {
  const [record, setRecord] = useState<LeaseActionRecord>({
    lease_id: '',
    contacted: false,
    flagged: false,
    notes: '',
    last_action_at: null,
  });
  const [noteInput, setNoteInput] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaveError, setNoteSaveError] = useState(false);

  // Load state on drawer open: API is source of truth, fallback to localStorage
  useEffect(() => {
    if (!lease) return;
    const local = getLeaseAction(lease.id);
    setRecord(local);
    setNoteInput(local.notes);
    setNoteSaved(false);

    // Async: fetch from API and merge if successful
    getLeaseActionsFromApi(lease.id).then(apiData => {
      if (apiData) {
        const merged = mergeApiRecord(lease.id, apiData);
        setRecord(merged);
        setNoteInput(merged.notes ?? '');
      }
    });
  }, [lease?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!lease) return null;

  const urgency = getUrgencyLevel(lease.days_until_expiration);
  const config = URGENCY_CONFIG[urgency];
  const badgeVariant = urgency === 'HIGH' ? 'danger' : urgency === 'MEDIUM' ? 'warning' : 'success';

  const formatDate = (dateStr: string) => {
    // Append T12:00:00 to prevent UTC midnight from shifting the date back one day
    // in negative-offset timezones (e.g. US/Eastern = UTC-4)
    const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatRent = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const persist = async (patch: Partial<Omit<LeaseActionRecord, 'lease_id' | 'last_action_at'>>) => {
    // 1. Update localStorage immediately (optimistic)
    const updated = updateLeaseAction(lease!.id, patch);
    setRecord(updated);
    onActionUpdate?.(lease!.id, updated);

    // 2. PUT to API — surface errors so data is never silently lost
    const apiResponse = await putLeaseActionsToApi(lease!.id, {
      contacted: updated.contacted,
      flagged: updated.flagged,
      notes: updated.notes,
      last_action_at: updated.last_action_at,
    });
    if (apiResponse) {
      const synced = mergeApiRecord(lease!.id, apiResponse);
      setRecord(synced);
      onActionUpdate?.(lease!.id, synced);
    } else {
      // API save failed — note is in localStorage only, warn the user
      toast.error('Note saved locally but could not sync to server. Please try again.', { duration: 6000 });
    }

    return updated;
  };

  const handleMarkContacted = () => {
    persist({ contacted: !record.contacted });
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim() || noteSaving) return;
    setNoteSaving(true);
    setNoteSaveError(false);
    try {
      await persist({ notes: noteInput.trim() });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch {
      setNoteSaveError(true);
      toast.error('Failed to save note. Please try again.');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCall = () => {
    persist({ contacted: record.contacted }); // touch last_action_at
    window.location.href = `tel:${lease.contact_phone}`;
  };

  const handleMessage = () => {
    persist({ contacted: record.contacted }); // touch last_action_at
    // BCC leasing@cynthiagardens.com on every outbound email
    // and the tenant's contact email as the recipient (to)
    const to   = encodeURIComponent(lease.contact_email ?? '');
    window.location.href = `mailto:${to}?bcc=${encodeURIComponent('leasing@cynthiagardens.com')}`;
  };

  const displayTimestamp = formatActionTimestamp(record.last_action_at);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${urgency === 'HIGH' ? 'bg-danger/15' : urgency === 'MEDIUM' ? 'bg-warning/15' : 'bg-accent/15'}`}>
              <User size={15} className={config.textClass} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-accent">Lease Detail</p>
              <h2 className="text-sm font-semibold text-text-primary leading-tight">{lease.tenant_name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label="Close drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Urgency Banner */}
          <div className={`px-6 py-3 border-b border-border/40 flex items-center justify-between ${urgency === 'HIGH' ? 'bg-danger/8' : urgency === 'MEDIUM' ? 'bg-warning/8' : 'bg-accent/8'}`}>
            <StatusBadge label={config.label + ' Urgency'} variant={badgeVariant} dot />
            <span className={`text-sm font-bold tabular-nums ${config.textClass}`}>
              {lease.days_until_expiration}d remaining
            </span>
          </div>

          {/* Lease Info Section */}
          <div className="px-6 py-5 border-b border-border/40">
            <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-4">Lease Information</p>
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-surface-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={13} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium">Tenant ID</p>
                  <p className="text-sm text-text-primary font-mono mt-0.5">{lease.id}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-surface-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Home size={13} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium">Unit</p>
                  <p className="text-sm text-text-primary font-mono mt-0.5">{lease.unit}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{lease.property}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-surface-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Calendar size={13} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium">Lease End Date</p>
                  <p className="text-sm text-text-primary mt-0.5">{formatDate(lease.lease_end_date)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-surface-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock size={13} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-xs text-text-muted font-medium">Days Until Expiration</p>
                  <p className={`text-sm font-bold tabular-nums mt-0.5 ${config.textClass}`}>
                    {lease.days_until_expiration} days
                  </p>
                </div>
              </div>
            </div>

            {/* Additional details */}
            <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-3">
              <div className="bg-surface-elevated rounded-lg p-3">
                <p className="text-xs text-text-muted font-medium">Monthly Rent</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5 tabular-nums">{formatRent(lease.monthly_rent)}</p>
              </div>
              <div className="bg-surface-elevated rounded-lg p-3">
                <p className="text-xs text-text-muted font-medium">Lease Type</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{lease.lease_type}</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="px-6 py-5 border-b border-border/40">
            <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-3">Contact</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Phone size={13} className="text-text-muted flex-shrink-0" />
                <span className="font-mono text-xs">{lease.contact_phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Mail size={13} className="text-text-muted flex-shrink-0" />
                <span className="text-xs truncate">{lease.contact_email}</span>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="px-6 py-5 border-b border-border/40">
            <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-4">Actions</p>

            {/* Call + Message buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={handleCall}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/8 transition-colors"
              >
                <Phone size={14} className="text-accent" />
                Call Tenant
              </button>
              <button
                onClick={handleMessage}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/8 transition-colors"
              >
                <Mail size={14} className="text-accent" />
                Send Message
              </button>
            </div>

            {/* Mark as Contacted toggle */}
            <button
              onClick={handleMarkContacted}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                record.contacted
                  ? 'bg-accent/10 border-accent/40 text-accent' :'bg-surface-elevated border-border text-text-secondary hover:border-accent/30 hover:text-text-primary'
              }`}
            >
              {record.contacted ? (
                <CheckCircle2 size={16} className="text-accent flex-shrink-0" />
              ) : (
                <Circle size={16} className="text-text-muted flex-shrink-0" />
              )}
              <span className="text-sm font-medium">
                {record.contacted ? 'Contacted' : 'Mark as Contacted'}
              </span>
              {record.contacted && (
                <span className="ml-auto text-xs text-accent/70 font-medium">✓ Done</span>
              )}
            </button>
          </div>

          {/* Add Note Section */}
          <div className="px-6 py-5 border-b border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote size={13} className="text-text-muted" />
              <p className="text-xs font-semibold tracking-widest uppercase text-accent">Add Note</p>
            </div>
            {record.notes && (
              <div className="mb-3 p-3 rounded-lg bg-surface-elevated border border-border">
                <p className="text-xs text-text-muted font-medium mb-1">Saved note</p>
                <p className="text-sm text-text-secondary">{record.notes}</p>
              </div>
            )}
            <textarea
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Add a note about this tenant or lease..."
              rows={3}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-colors resize-none"
            />
            <button
              onClick={handleSaveNote}
              disabled={!noteInput.trim() || noteSaving}
              className={`mt-2 w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                noteSaveError
                  ? 'bg-danger/15 text-danger border border-danger/40'
                  : noteInput.trim() && !noteSaving
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-surface-elevated text-text-muted cursor-not-allowed border border-border'
              }`}
            >
              {noteSaving ? (
                <><Loader2 size={14} className="animate-spin" /> Saving to server...</>
              ) : noteSaved ? (
                '✓ Saved'
              ) : noteSaveError ? (
                <><AlertCircle size={14} /> Save failed — retry</>
              ) : (
                'Save Note'
              )}
            </button>
          </div>

          {/* Status Footer */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-muted font-medium">Status</p>
                <p className={`text-sm font-semibold mt-0.5 ${record.contacted ? 'text-accent' : 'text-text-secondary'}`}>
                  {record.contacted ? 'Contacted' : 'Not Contacted'}
                </p>
              </div>
              {displayTimestamp && (
                <div className="text-right">
                  <p className="text-xs text-text-muted font-medium">Last Action</p>
                  <p className="text-xs text-text-secondary mt-0.5">{displayTimestamp}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
