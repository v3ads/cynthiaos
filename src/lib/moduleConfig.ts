// Central Module Configuration
// Add or remove modules here — sidebar and routing update automatically.

export type ModuleType = 'internal' | 'external';
export type ModuleStatus = 'active' | 'coming_soon' | 'beta';

export interface AppModule {
  id: string;
  name: string;
  type: ModuleType;
  route?: string;
  url?: string;
  status: ModuleStatus;
  description?: string;
  badge?: string;
}

export interface ModuleGroup {
  id: string;
  label: string;
  modules: AppModule[];
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: 'group-operations',
    label: 'Operations',
    modules: [
      {
        id: 'mod-dashboard',
        name: 'Dashboard',
        type: 'internal',
        route: '/dashboard',
        status: 'active',
        description: 'Command center overview',
      },
      {
        id: 'mod-leases',
        name: 'Leases',
        type: 'internal',
        route: '/lease-expirations',
        status: 'active',
        description: 'Lease expirations and renewals',
      },
    ],
  },
  {
    id: 'group-intelligence',
    label: 'Intelligence',
    modules: [
      {
        id: 'mod-insights',
        name: 'Insights',
        type: 'internal',
        route: '/insights',
        status: 'active',
        description: 'Portfolio intelligence — all 5 insight modules',
      },
      {
        id: 'mod-alerts',
        name: 'Alerts',
        type: 'internal',
        route: '/alerts',
        status: 'coming_soon',
        description: 'Portfolio alerts and notifications',
      },
      {
        id: 'mod-tasks',
        name: 'Tasks',
        type: 'internal',
        route: '/tasks',
        status: 'active',
        description: 'Task management and assignments',
      },
    ],
  },
  {
    id: 'group-modules',
    label: 'Modules',
    modules: [
      {
        id: 'mod-jasmine',
        name: 'Jasmine',
        type: 'external',
        url: 'https://jasmine.cynthiagardens.com/',
        status: 'active',
        description: 'AI leasing agent',
        badge: 'AI',
      },
    ],
  },
  {
    id: 'group-system',
    label: 'System',
    modules: [
      {
        id: 'mod-pipeline-monitor',
        name: 'Pipeline Monitor',
        type: 'internal',
        route: '/pipeline',
        status: 'active',
        description: 'Data pipeline health, integrity checks, and validation logs',
      },
    ],
  },
];

export const ALL_MODULES: AppModule[] = MODULE_GROUPS.flatMap(g => g.modules);
