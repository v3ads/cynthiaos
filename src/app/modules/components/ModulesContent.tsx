import React from 'react';
import { EXTERNAL_MODULES } from '@/lib/modules';
import ModuleCard from './ModuleCard';
import { Puzzle } from 'lucide-react';

export default function ModulesContent() {
  const activeModules = EXTERNAL_MODULES?.filter(m => m?.status !== 'coming_soon');
  const comingSoonModules = EXTERNAL_MODULES?.filter(m => m?.status === 'coming_soon');

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
            <Puzzle size={18} className="text-text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Modules</h1>
            <p className="text-text-secondary text-sm mt-0.5">Integrated tools and external services</p>
          </div>
        </div>
      </div>
      {/* Info Banner */}
      <div className="bg-surface-elevated border border-border/50 rounded-xl px-4 py-3 mb-8 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          Modules open in a new tab. Each tool connects to its own service and operates independently of CynthiaOS.
        </p>
      </div>
      {/* Active Modules */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Available</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {activeModules?.map(module => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </div>
      {/* Coming Soon */}
      {comingSoonModules?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Coming Soon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {comingSoonModules?.map(module => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}