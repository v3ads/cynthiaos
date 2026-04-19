'use client';

import React from 'react';
import { ExternalModule } from '@/lib/modules';
import { Bot, Wrench, BarChart3, MessageSquare, ArrowUpRight } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

const ICON_MAP = {
  Bot,
  Wrench,
  BarChart3,
  MessageSquare,
};

const CATEGORY_COLORS = {
  ai_agent: 'bg-accent/12 text-accent border-accent/20',
  communication: 'bg-info/12 text-info border-info/20',
  analytics: 'bg-warning/12 text-warning border-warning/20',
  maintenance: 'bg-surface-elevated text-text-secondary border-border',
  other: 'bg-surface-elevated text-text-secondary border-border',
};

interface ModuleCardProps {
  module: ExternalModule;
}

export default function ModuleCard({ module }: ModuleCardProps) {
  const IconComponent = ICON_MAP[module.icon as keyof typeof ICON_MAP] || Bot;
  const isComingSoon = module.status === 'coming_soon';
  const isBeta = module.status === 'beta';

  const handleOpen = () => {
    if (!isComingSoon && module.url !== '#') {
      window.open(module.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 transition-all ${!isComingSoon ? 'hover:border-border hover:shadow-lg hover:shadow-black/20 cursor-pointer group' : 'opacity-60'}`}>
      {/* Icon + Badges */}
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${CATEGORY_COLORS[module.category]}`}>
          <IconComponent size={20} />
        </div>
        <div className="flex items-center gap-1.5">
          {module.badge && (
            <StatusBadge
              label={module.badge}
              variant={module.badge === 'AI Agent' ? 'success' : 'info'}
            />
          )}
          {isComingSoon && (
            <StatusBadge label="Coming Soon" variant="neutral" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="text-base font-semibold text-text-primary">{module.name}</h3>
        <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">{module.description}</p>
      </div>

      {/* Action */}
      {!isComingSoon ? (
        <button
          onClick={handleOpen}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-sm font-semibold hover:bg-accent/20 hover:border-accent/40 active:scale-[0.98] transition-all"
        >
          <span>Open {module.name}</span>
          <ArrowUpRight size={14} />
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-surface-elevated border border-border text-text-muted text-sm font-medium cursor-not-allowed">
          Not yet available
        </div>
      )}
    </div>
  );
}