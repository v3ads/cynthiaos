const API_BASE = process.env.CYNTHIAOS_API_URL;

if (!API_BASE) {
  throw new Error('CYNTHIAOS_API_URL environment variable is not set.');
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const url = resolveUrl(name, input);
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jasmine API error ${res.status} on ${url}: ${body}`);
  }
  return res.json();
}

function resolveUrl(name: string, input: Record<string, unknown>): string {
  const base = API_BASE!;
  switch (name) {
    case 'get_portfolio_summary':
      return `${base}/api/jasmine/portfolio-summary`;
    case 'get_units': {
      const p = new URLSearchParams();
      if (input.status) p.set('status', String(input.status));
      if (input.building) p.set('building', String(input.building));
      return `${base}/api/jasmine/units?${p}`;
    }
    case 'get_unit_detail':
      return `${base}/api/jasmine/units/${encodeURIComponent(String(input.unit_id))}`;
    case 'get_expiring_leases': {
      const p = new URLSearchParams();
      if (input.window_days !== undefined) p.set('window_days', String(input.window_days));
      return `${base}/api/jasmine/leases?${p}`;
    }
    case 'get_notices':
      return `${base}/api/jasmine/notices`;
    case 'get_delinquency': {
      const p = new URLSearchParams();
      if (input.risk) p.set('risk', String(input.risk));
      return `${base}/api/jasmine/delinquency?${p}`;
    }
    case 'get_below_market_units': {
      const p = new URLSearchParams();
      if (input.threshold_pct !== undefined) p.set('threshold_pct', String(input.threshold_pct));
      return `${base}/api/jasmine/below-market?${p}`;
    }
    case 'get_long_vacancies': {
      const p = new URLSearchParams();
      if (input.min_days !== undefined) p.set('min_days', String(input.min_days));
      return `${base}/api/jasmine/long-vacancies?${p}`;
    }
    case 'search_tenants': {
      const p = new URLSearchParams();
      p.set('search', String(input.search));
      return `${base}/api/jasmine/tenants?${p}`;
    }
    case 'get_move_schedule': {
      const p = new URLSearchParams();
      if (input.type) p.set('type', String(input.type));
      if (input.window_days !== undefined) p.set('window_days', String(input.window_days));
      return `${base}/api/jasmine/move-schedule?${p}`;
    }
    case 'get_work_orders': {
      const p = new URLSearchParams();
      if (input.status) p.set('status', String(input.status));
      return `${base}/api/jasmine/work-orders?${p}`;
    }
    case 'get_open_tasks':
      return `${base}/api/jasmine/tasks`;
    case 'get_unit_overrides':
      return `${base}/api/jasmine/unit-overrides`;
    
    case 'get_aged_receivables':
      return `${base}/api/jasmine/aged-receivables`;
    case 'get_applicants':
      return `${base}/api/jasmine/applicants`;
    case 'get_inspections':
      return `${base}/api/jasmine/inspections`;
    case 'get_insurance':
      return `${base}/api/jasmine/insurance`;
    case 'get_general_ledger': {
      const p = new URLSearchParams();
      if (input.account) p.set('account', String(input.account));
      return `${base}/api/jasmine/general-ledger?${p}`;
    }
    case 'get_vendors': {
      const p = new URLSearchParams();
      if (input.trade) p.set('trade', String(input.trade));
      return `${base}/api/jasmine/vendors?${p}`;
    }
    case 'get_prospects':
      return `${base}/api/jasmine/prospects`;
    case 'get_work_orders': {
      const p = new URLSearchParams();
      if (input.status) p.set('status', String(input.status));
      return `${base}/api/jasmine/work-orders?${p}`;
    }
    default:
      throw new Error(`Unknown Jasmine tool: ${name}`);
  }
}
