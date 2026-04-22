'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import {
  LayoutDashboard,
  FileText,
  Bell,
  CheckSquare,
  Puzzle,
  Bot,
  ChevronLeft,
  ChevronRight,
  User,
  ExternalLink,
  LogOut,
  GitMerge,
  BarChart2,
  Activity,
  Layers,
  Filter,
  Wrench,
  DollarSign,
  Users,
  Home,
} from 'lucide-react';
import { MODULE_GROUPS, AppModule } from '@/lib/moduleConfig';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';


// Map module IDs to icons
const MODULE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'mod-dashboard':        LayoutDashboard,
  'mod-leases':           FileText,
  'mod-pipeline':         GitMerge,
  'mod-insights':         BarChart2,
  'mod-unit-intelligence':Layers,
  'mod-leasing-funnel':   Filter,
  'mod-maintenance':      Wrench,
  'mod-alerts':           Bell,
  'mod-tasks':            CheckSquare,
  'mod-jasmine':          Bot,
  'mod-jasmine-beta':     Bot,
  'mod-pipeline-monitor': Activity,
  'mod-financials':       DollarSign,
  'mod-ar-aging':         BarChart2,
  'mod-leasing-pipeline': Users,
  'mod-unit-turns':       Home,
  'mod-vendors':          Wrench,
};

const DEFAULT_ICON = Puzzle;

function getIcon(moduleId: string) {
  return MODULE_ICONS[moduleId] || DEFAULT_ICON;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const isActive = (mod: AppModule) => {
    if (mod.type === 'internal' && mod.route) return pathname === mod.route;
    return false;
  };

  const handleExternalClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderModuleItem = (mod: AppModule) => {
    const Icon = getIcon(mod.id);
    const active = isActive(mod);
    const isComingSoon = mod.status === 'coming_soon';

    if (collapsed) {
      // Collapsed: icon only with tooltip
      if (mod.type === 'external') {
        return (
          <div key={mod.id} className="relative group">
            <button
              onClick={() => handleExternalClick(mod.url || '#')}
              className="flex items-center justify-center w-9 h-9 rounded-lg mx-auto transition-colors text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
              aria-label={mod.name}
            >
              <Icon size={18} />
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden group-hover:block">
              <div className="bg-surface-elevated border border-border rounded-md shadow-xl px-3 py-1.5 flex items-center gap-1.5">
                <span className="text-sm text-text-primary whitespace-nowrap">{mod.name}</span>
                <ExternalLink size={11} className="text-text-muted" />
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={mod.id} className="relative group">
          <Link
            href={mod.route || '#'}
            className={`flex items-center justify-center w-9 h-9 rounded-lg mx-auto transition-colors ${
              active
                ? 'bg-accent/15 text-accent'
                : isComingSoon
                ? 'text-text-muted/50 cursor-default pointer-events-none' :'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
            }`}
            aria-label={mod.name}
          >
            <Icon size={18} />
          </Link>
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden group-hover:block">
            <div className="bg-surface-elevated border border-border rounded-md shadow-xl px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-sm text-text-primary whitespace-nowrap">{mod.name}</span>
              {isComingSoon && <span className="text-xs text-text-secondary">(soon)</span>}
            </div>
          </div>
        </div>
      );
    }

    // Expanded: full row
    if (mod.type === 'external') {
      return (
        <button
          key={mod.id}
          onClick={() => handleExternalClick(mod.url || '#')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-text-muted hover:text-text-secondary hover:bg-surface-elevated group"
        >
          <Icon size={17} className="flex-shrink-0" />
          <span className="flex-1 text-left">{mod.name}</span>
          {mod.badge && (
            <span className="text-xs bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium">
              {mod.badge}
            </span>
          )}
          <ExternalLink size={12} className="text-text-muted/50 group-hover:text-text-muted transition-colors" />
        </button>
      );
    }

    return (
      <Link
        key={mod.id}
        href={mod.route || '#'}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-accent/12 text-accent font-medium'
            : isComingSoon
            ? 'text-text-muted/50 cursor-default pointer-events-none' :'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
        }`}
      >
        <Icon size={17} className="flex-shrink-0" />
        <span className="flex-1">{mod.name}</span>
        {isComingSoon && (
          <span className="text-xs text-text-muted/60 bg-surface-elevated px-1.5 py-0.5 rounded-full border border-border/50">
            Soon
          </span>
        )}
        {mod.badge && !isComingSoon && (
          <span className="text-xs bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-medium">
            {mod.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`flex items-center border-b border-border/50 transition-all duration-300 ${
          collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4 gap-3'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AppLogo size={28} />
          {!collapsed && (
            <span className="font-semibold text-text-primary text-base tracking-tight truncate">
              CynthiaOS
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Dynamic Nav from MODULE_GROUPS */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
        {MODULE_GROUPS.map((group, groupIdx) => (
          <div key={group.id}>
            {/* Divider + label only for named groups after the first */}
            {group.label && groupIdx > 0 && (
              <div className={`${collapsed ? 'mx-2' : 'mx-1'} mb-2 border-t border-border/30`} />
            )}
            {group.label && !collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted/60">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.modules.map(mod => renderModuleItem(mod))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-border/50 p-3 space-y-1 ${
          collapsed ? 'flex flex-col items-center' : ''
        }`}
      >
        {collapsed ? (
          <>
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={16} />
            </button>
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <User size={16} className="text-accent" />
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-elevated transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.email?.split('@')[0] ?? ''}
                </p>
                <p className="text-xs text-text-muted truncate">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-red-400 hover:bg-surface-elevated transition-colors"
            >
              <LogOut size={17} className="flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 bg-surface border-r border-border/50 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 p-2 bg-surface border border-border rounded-lg text-text-secondary"
          aria-label="Open menu"
        >
          <LayoutDashboard size={18} />
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-56 bg-surface border-r border-border flex flex-col h-full z-10">
              {sidebarContent}
            </aside>
          </div>
        )}
      </div>
    </>
  );
}