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
    id: 'group-main',
    label: '',
    modules: [
      {
        id: 'mod-dashboard',
        name: 'Home',
        type: 'internal',
        route: '/dashboard',
        status: 'active',
        description: 'Morning snapshot — metrics, alerts, top tasks',
      },
      {
        id: 'mod-leases',
        name: 'Leases',
        type: 'internal',
        route: '/lease-expirations',
        status: 'active',
        description: 'Lease expirations, renewals, and unit intelligence',
      },
      {
        id: 'mod-maintenance',
        name: 'Maintenance',
        type: 'internal',
        route: '/maintenance',
        status: 'active',
        description: 'Work orders and maintenance requests',
      },
      {
        id: 'mod-tasks',
        name: 'Tasks',
        type: 'internal',
        route: '/tasks',
        status: 'active',
        description: 'Prioritized work queue — alerts and actions',
      },
      {
        id: 'mod-jasmine',
        name: 'Jasmine',
        type: 'external',
        url: 'https://jasmine.cynthiagardens.com/',
        status: 'active',
        description: 'AI leasing agent',
        badge: 'AI',
      },
      {
        id: 'mod-jasmine-beta',
        name: 'Ask Jasmine (Beta)',
        type: 'internal',
        route: '/jasmine',
        status: 'beta',
        description: 'AI property assistant powered by CynthiaOS live data',
        badge: 'Beta',
      },
    ],
  },
  {
    id: 'group-finance',
    label: 'Finance',
    modules: [
      {
        id: 'mod-financials',
        name: 'Financials',
        type: 'internal',
        route: '/financials',
        status: 'active',
        description: 'Income statement and general ledger',
      },
      {
        id: 'mod-ar-aging',
        name: 'AR Aging',
        type: 'internal',
        route: '/ar-aging',
        status: 'active',
        description: 'Accounts receivable aging by tenant and bucket',
      },
    ],
  },
  {
    id: 'group-leasing',
    label: 'Leasing',
    modules: [
      {
        id: 'mod-leasing-pipeline',
        name: 'Pipeline',
        type: 'internal',
        route: '/leasing-pipeline',
        status: 'active',
        description: 'Active prospects and applicants',
      },
    ],
  },
  {
    id: 'group-operations',
    label: 'Operations',
    modules: [
      {
        id: 'mod-unit-turns',
        name: 'Unit Turns',
        type: 'internal',
        route: '/unit-turns',
        status: 'active',
        description: 'Make-ready status and turnaround performance',
      },
      {
        id: 'mod-vendors',
        name: 'Vendors',
        type: 'internal',
        route: '/vendors',
        status: 'active',
        description: 'Approved contractor directory',
      },
    ],
  },
  {
    id: 'group-system',
    label: 'System',
    modules: [
      {
        id: 'mod-pipeline-monitor',
        name: 'Pipeline',
        type: 'internal',
        route: '/pipeline',
        status: 'active',
        description: 'Data pipeline health and validation logs',
      },
    ],
  },
];

export const ALL_MODULES: AppModule[] = MODULE_GROUPS.flatMap(g => g.modules);
