// Configurable external modules registry
// Add new tools here — no code changes needed in components

export interface ExternalModule {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  status: 'active' | 'beta' | 'coming_soon';
  category: 'ai_agent' | 'communication' | 'analytics' | 'maintenance' | 'other';
  badge?: string;
}

// Backend integration: this could be fetched from /api/v1/modules in future
export const EXTERNAL_MODULES: ExternalModule[] = [
  {
    id: 'module-jasmine',
    name: 'Jasmine',
    description: 'AI leasing agent that handles inquiries, schedules tours, and qualifies prospects automatically.',
    url: 'https://jasmine.cynthiaos.com',
    icon: 'Bot',
    status: 'active',
    category: 'ai_agent',
    badge: 'AI Agent',
  },
  {
    id: 'module-maintenance',
    name: 'MaintenanceIQ',
    description: 'Work order management and vendor coordination platform integrated with your property portfolio.',
    url: '#',
    icon: 'Wrench',
    status: 'coming_soon',
    category: 'maintenance',
  },
  {
    id: 'module-analytics',
    name: 'Portfolio Analytics',
    description: 'Deep-dive reporting on occupancy trends, rent growth, and portfolio performance over time.',
    url: '#',
    icon: 'BarChart3',
    status: 'coming_soon',
    category: 'analytics',
  },
  {
    id: 'module-comms',
    name: 'TenantConnect',
    description: 'Bulk messaging, automated reminders, and two-way communication with tenants via SMS and email.',
    url: '#',
    icon: 'MessageSquare',
    status: 'beta',
    category: 'communication',
    badge: 'Beta',
  },
];