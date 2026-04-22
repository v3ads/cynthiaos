import Anthropic from '@anthropic-ai/sdk';

export const JASMINE_TOOLS: Anthropic.Tool[] = [
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
  {
    name: 'get_open_tasks',
    description:
      'Get all open or pending operational tasks ordered by priority. ' +
      'Use when asked about what needs attention, pending work, or team priorities.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_unit_overrides',
    description:
      'Get the list of units excluded from vacancy and revenue calculations. ' +
      'These are family and employee units. Use when asked why certain units are excluded, ' +
      'how many override units exist, or which units are family or employee designated.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
];
