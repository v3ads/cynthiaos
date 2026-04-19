import React from 'react';
import AppLayout from '@/components/AppLayout';
import { Bell } from 'lucide-react';

export default function AlertsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Intelligence</p>
          <h1 className="text-2xl font-bold text-text-primary">Alerts</h1>
          <p className="text-sm text-text-secondary mt-1">Portfolio alerts and notifications</p>
        </div>

        {/* Coming Soon */}
        <div className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
              <Bell size={28} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-3">Coming Soon</h2>
            <p className="text-text-muted text-sm leading-relaxed">
              This module will provide real-time portfolio alerts, lease event notifications, and configurable thresholds to keep you ahead of critical deadlines.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated border border-border text-xs text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
              In development
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
