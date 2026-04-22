import Anthropic from '@anthropic-ai/sdk';

export const JASMINE_TOOLS: Anthropic.Tool[] = [
  // ── Portfolio & Units ──────────────────────────────────────────────────────
  {
    name: 'get_portfolio_summary',
    description:
      'Get overall portfolio statistics for Cynthia Gardens including total units, ' +
      'occupancy count, vacancy count, vacancy rate, total monthly rent, average rent, ' +
      'and last pipeline run time. Use this for any high-level property overview question.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_units',
    description:
      'List units filtered by occupancy status and optionally by building. ' +
      'Use this to answer questions about vacant units, occupied units, units on notice, ' +
      'or units in a specific building.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['vacant', 'occupied', 'notice', 'all'],
          description: 'Filter by occupancy status. Defaults to all.',
        },
        building: {
          type: 'string',
          description: 'Optional building filter e.g. B.1 or B.2.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_unit_detail',
    description:
      'Get full details for a specific unit including tenant name, lease dates, ' +
      'monthly rent, contact info, unit notes, contact status, and flags. ' +
      'Use when a specific unit number is mentioned.',
    input_schema: {
      type: 'object' as const,
      properties: {
        unit_id: { type: 'string', description: 'The unit number e.g. 205 or 114-A.' },
      },
      required: ['unit_id'],
    },
  },
  {
    name: 'get_unit_overrides',
    description:
      'Get the list of units excluded from vacancy and revenue calculations. ' +
      'These are family and employee units. Use when asked why certain units are excluded, ' +
      'how many override units exist, or which units are family or employee designated.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },

  // ── Leases & Tenants ───────────────────────────────────────────────────────
  {
    name: 'get_expiring_leases',
    description:
      'Get leases expiring within a given number of days ordered by soonest first. ' +
      'Use for renewal pipeline questions, expiration alerts, and outreach planning.',
    input_schema: {
      type: 'object' as const,
      properties: {
        window_days: { type: 'number', description: 'Number of days to look ahead. Defaults to 90.' },
      },
      required: [],
    },
  },
  {
    name: 'get_notices',
    description:
      'Get all tenants who have given notice to vacate. Returns unit, tenant name, ' +
      'lease end date, monthly rent, and contact info. Use for turnover planning.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'search_tenants',
    description:
      'Search for tenants by name or unit number using a case-insensitive partial match. ' +
      'Use when a specific person or unit is mentioned by name in the query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Name or unit number to search for.' },
      },
      required: ['search'],
    },
  },
  {
    name: 'get_move_schedule',
    description:
      'Get upcoming move-ins or move-outs within a given day window. ' +
      'Use for scheduling questions, turnover planning, and unit availability forecasting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['in', 'out'],
          description: 'Filter to move-ins or move-outs only. Omit for both.',
        },
        window_days: { type: 'number', description: 'Number of days to look ahead. Defaults to 30.' },
      },
      required: [],
    },
  },

  // ── Collections & Financials ───────────────────────────────────────────────
  {
    name: 'get_delinquency',
    description:
      'Get delinquent accounts filtered by risk level. ' +
      'Use for collections questions, financial health checks, and overdue rent analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        risk: {
          type: 'string',
          enum: ['high', 'medium', 'low', 'all'],
          description: 'Filter by risk level. Defaults to all.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_aged_receivables',
    description:
      'Get accounts receivable aging details from the Gold layer. ' +
      'Returns buckets: 0-30, 31-60, 61-90, and 90+ days overdue per tenant. ' +
      'Use for AR aging questions, collections reporting, and large outstanding balance analysis. ' +
      'Pass bucket param to filter to a specific aging tier.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bucket: {
          type: 'string',
          enum: ['30', '60', '90', '90_plus'],
          description: 'Filter to tenants whose dominant balance falls in this aging bucket. Omit for all.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_general_ledger',
    description:
      'Get general ledger accounting entries from the Gold layer. ' +
      'Can filter by GL account name and/or date range. ' +
      'IMPORTANT: Always pass start_date and end_date when asking about a specific month or period — ' +
      'without a date range this returns 2,000+ rows. ' +
      'Use for financial reporting, expense tracking, and revenue questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        account: {
          type: 'string',
          description: 'Optional GL account name to filter by (e.g. "Operating Cash", "Rental Income").',
        },
        start_date: {
          type: 'string',
          description: 'Start date filter in YYYY-MM-DD format (e.g. "2026-04-01").',
        },
        end_date: {
          type: 'string',
          description: 'End date filter in YYYY-MM-DD format (e.g. "2026-04-30").',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_income_statement',
    description:
      'Get the income statement from the Gold layer, including total income, rental income, ' +
      'other income, total expenses, net operating income, profit margin, and month-to-date figures. ' +
      'Also returns the last 12 months of history for trend analysis. ' +
      'Use for any P&L, revenue, expense, NOI, or financial performance questions.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },

  // ── Revenue Optimization ───────────────────────────────────────────────────
  {
    name: 'get_below_market_units',
    description:
      'Find units currently renting below market rate by a given percentage threshold. ' +
      'Use for revenue optimization, rent increase planning, and below-market analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threshold_pct: { type: 'number', description: 'Minimum percentage below market to include. Defaults to 10.' },
      },
      required: [],
    },
  },
  {
    name: 'get_long_vacancies',
    description:
      'Find units that have been vacant longer than a minimum number of days. ' +
      'Use for long-term vacancy review, lost revenue analysis, and leasing team prioritization.',
    input_schema: {
      type: 'object' as const,
      properties: {
        min_days: { type: 'number', description: 'Minimum days vacant to include. Defaults to 90.' },
      },
      required: [],
    },
  },

  // ── Leasing Pipeline ───────────────────────────────────────────────────────
  {
    name: 'get_applicants',
    description:
      'Get the current pipeline of rental applicants from the Gold layer, including status, ' +
      'unit applied for, monthly rent, move-in date, and source. ' +
      'Use for leasing funnel questions, pending applications, and move-in pipeline. ' +
      'Pass status to filter (e.g. "Approved", "Pending", "Denied", "Converted").',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Optional status filter (e.g. "Approved", "Pending", "Denied", "Converted"). Case-insensitive partial match.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_prospects',
    description:
      'Get the list of leasing prospects (guest cards) from the Gold layer with their current status, ' +
      'source, bed/bath preference, max rent, move-in preference, and last activity. ' +
      'Use for lead tracking, showing activity, and leasing pipeline questions. ' +
      'Pass status to filter (e.g. "Active", "Inactive", "Converted").',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Optional status filter (e.g. "Active", "Inactive", "Converted"). Case-insensitive partial match.',
        },
      },
      required: [],
    },
  },

  // ── Maintenance & Operations ───────────────────────────────────────────────
  {
    name: 'get_work_orders',
    description:
      'Get maintenance and work order requests from AppFolio. ' +
      'Use for any question about maintenance requests, repairs, open work orders, ' +
      'maintenance issues, or what is currently being worked on in the building. ' +
      'Returns work order ID, unit, status, priority, issue type, description, ' +
      'tenant, assigned staff, vendor, and created date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'all'],
          description: 'Filter to open (Assigned/New/Pending) work orders only, or all. Defaults to open.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_inspections',
    description:
      'Get recent unit turn details from the Gold layer, including move-out dates, ' +
      'expected move-in dates, turnaround times, and total billed amounts. ' +
      'Use for unit turn questions, make-ready status, and maintenance turnaround performance.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_open_tasks',
    description:
      'Get open or pending internal CynthiaOS action items created by the management team. ' +
      'These are NOT maintenance requests — use get_work_orders for maintenance. ' +
      'Use this for internal team to-do items and follow-up tasks.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },

  // ── Vendors & Insurance ────────────────────────────────────────────────────
  {
    name: 'get_vendors',
    description:
      'Get the directory of approved vendors and contractors from the Gold layer. ' +
      'Can optionally filter by trade or type. ' +
      'Use for finding vendor contact info, payment types, and trade specialties.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trade: {
          type: 'string',
          description: 'Optional trade or vendor type to filter by (e.g. "Plumbing", "General", "Pest").',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_insurance',
    description:
      'Get tenant renters insurance policy expiration dates. ' +
      'Note: This data is currently a stub as it is not syncing from AppFolio yet.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
];
