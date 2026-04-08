// Backend integration point — all API calls route through this module
// Base URL must be set via NEXT_PUBLIC_API_URL environment variable in production

// NOTE: Do NOT resolve API_BASE at module level — Next.js inlines NEXT_PUBLIC_* at build time,
// and a top-level const will be an empty string if the variable was unset during the build.
// Resolve inside fetchApi() so the value is always read fresh at call time.
const FALLBACK_API_BASE = 'https://cynthiaos-api-production.up.railway.app';

// ─── Query window configuration ───────────────────────────────────────────────
// Adjust these values to match the time ranges present in the current dataset.
// expiringSoonDays: upper bound (days) for the expiring-soon query window.
// renewalFromDays / renewalToDays: inclusive range for upcoming-renewals.
export const QUERY_WINDOWS = {
  expiringSoonDays: 400,
  renewalFromDays: 300,
  renewalToDays: 400,
};

export interface LeaseExpiration {
  id: string;
  tenant_name: string;
  unit: string;
  property: string;
  lease_end_date: string;
  days_until_expiration: number;
  monthly_rent: number;
  contact_email: string;
  contact_phone: string;
  lease_type: string;
}

export interface UpcomingRenewal {
  id: string;
  tenant_name: string;
  unit: string;
  property: string;
  renewal_date: string;
  days_until_renewal: number;
  current_rent: number;
  proposed_rent: number;
  renewal_status: 'pending' | 'in_progress' | 'signed' | 'declined';
  contact_email: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  limit?: number;
  offset?: number;
}

export interface ApiError {
  message: string;
  status: number;
}

// ─── Response shape normalizer ────────────────────────────────────────────────
// Handles all known API response shapes and extracts the items array + total.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArray(raw: any): { items: any[]; total: number } {
  // Shape 1: root array  →  [ ... ]
  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length };
  }

  // Shape 2: { data: [...] }
  if (raw && Array.isArray(raw.data)) {
    return { items: raw.data, total: raw.total ?? raw.count ?? raw.data.length };
  }

  // Shape 3: { results: [...] }
  if (raw && Array.isArray(raw.results)) {
    return { items: raw.results, total: raw.total ?? raw.count ?? raw.results.length };
  }

  // Shape 4: { items: [...] }
  if (raw && Array.isArray(raw.items)) {
    return { items: raw.items, total: raw.total ?? raw.count ?? raw.items.length };
  }

  // Shape 5: { data: { items: [...] } }
  if (raw && raw.data && Array.isArray(raw.data.items)) {
    return { items: raw.data.items, total: raw.data.total ?? raw.total ?? raw.data.items.length };
  }

  // Shape 6: { data: { results: [...] } }
  if (raw && raw.data && Array.isArray(raw.data.results)) {
    return { items: raw.data.results, total: raw.data.total ?? raw.total ?? raw.data.results.length };
  }

  // Fallback: unknown shape — log and return empty
  console.warn('[CynthiaOS API] Unknown response shape — could not extract array:', raw);
  return { items: [], total: 0 };
}

// ─── Field-name mapper for LeaseExpiration ────────────────────────────────────
// Maps any known API field variants to the canonical UI field names.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTenantName(raw: any): string {
  // Prefer human-readable name fields over normalized IDs
  const name = raw.display_name ?? raw.full_name ?? raw.tenant_name ?? raw.tenantName ?? raw.tenant ?? '';
  const source = name || raw.tenant_id || '';
  if (!source) return '—';
  // Convert ALL_CAPS "LAST, FIRST" AppFolio format to "First Last"
  if (/^[A-Z][A-Z\s,.'\-]+$/.test(source) && source.includes(',')) {
    const [last, ...firstParts] = source.split(',').map((s: string) => s.trim());
    const first = firstParts.join(' ');
    return [first, last]
      .filter(Boolean)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  // Convert snake_case tenant_id slugs to Title Case (e.g. "dean_w_martin" → "Dean W Martin")
  if (/^[a-z_]+$/.test(source)) {
    return source.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return source;
}

function mapLeaseExpiration(raw: any): LeaseExpiration {
  return {
    id:                    raw.id ?? raw.lease_id ?? raw._id ?? '',
    tenant_name:           formatTenantName(raw),
    unit:                  raw.unit_id ?? raw.unit ?? raw.unit_number ?? raw.unitNumber ?? '',
    property:              raw.property ?? raw.property_name ?? raw.propertyName ?? raw.building ?? 'Cynthia Gardens',
    lease_end_date:        raw.lease_end_date ?? raw.leaseEndDate ?? raw.end_date ?? raw.expiration_date ?? '',
    days_until_expiration: raw.days_until_expiration ?? raw.daysUntilExpiration ?? raw.days_remaining ?? raw.days_left ?? 0,
    monthly_rent:          raw.monthly_rent ?? raw.monthlyRent ?? raw.scheduled_rent ?? raw.market_rent ?? raw.rent ?? raw.rent_amount ?? 0,
    contact_email:         raw.contact_email ?? raw.contactEmail ?? raw.email ?? '',
    contact_phone:         raw.contact_phone ?? raw.contactPhone ?? raw.phone ?? raw.phone_number ?? '',
    lease_type:            raw.lease_type ?? raw.leaseType ?? raw.type ?? 'Standard',
  };
}

// ─── Field-name mapper for UpcomingRenewal ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUpcomingRenewal(raw: any): UpcomingRenewal {
  return {
    id:               raw.id ?? raw.renewal_id ?? raw._id ?? '',
    tenant_name:      raw.tenant_name ?? raw.tenantName ?? raw.tenant ?? '',
    unit:             raw.unit ?? raw.unit_number ?? raw.unitNumber ?? '',
    property:         raw.property ?? raw.property_name ?? raw.propertyName ?? raw.building ?? '',
    renewal_date:     raw.renewal_date ?? raw.renewalDate ?? raw.lease_end_date ?? raw.end_date ?? '',
    days_until_renewal: raw.days_until_renewal ?? raw.daysUntilRenewal ?? raw.days_remaining ?? raw.days_left ?? 0,
    current_rent:     raw.current_rent ?? raw.currentRent ?? raw.monthly_rent ?? raw.rent ?? 0,
    proposed_rent:    raw.proposed_rent ?? raw.proposedRent ?? raw.new_rent ?? raw.current_rent ?? raw.monthly_rent ?? 0,
    renewal_status:   raw.renewal_status ?? raw.renewalStatus ?? raw.status ?? 'pending',
    contact_email:    raw.contact_email ?? raw.contactEmail ?? raw.email ?? '',
  };
}

// ─── Core fetch utility ───────────────────────────────────────────────────────
async function fetchApi<T>(
  endpoint: string,
  params?: Record<string, string | number>
): Promise<T> {
  // Route through the Next.js proxy to avoid CORS — the proxy calls the real API server-side.
  const proxyUrl = new URL('/api/proxy', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  proxyUrl.searchParams.set('_path', endpoint);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      proxyUrl.searchParams.set(key, String(value));
    });
  }

  const fullUrl = proxyUrl.toString();
  const method = 'GET';

  try {
    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[CynthiaOS API] Non-OK response:', {
        fullUrl,
        method,
        status: response.status,
        statusText: response.statusText,
      });
      throw { message: response.statusText, status: response.status } as ApiError;
    }

    const json = await response.json();
    console.log('[CynthiaOS API] Raw proxy response for', endpoint, '— length check:',
      Array.isArray(json) ? json.length : (Array.isArray(json?.data) ? json.data.length : '(non-array root)'),
      '| keys:', json && typeof json === 'object' ? Object.keys(json) : typeof json
    );
    return json as T;
  } catch (fetchError) {
    if (!(fetchError as ApiError).status) {
      console.error('[CynthiaOS API] fetch() failed:', {
        fullUrl,
        method,
        error: fetchError,
      });
    }
    throw fetchError;
  }
}

// ─── GET /api/v1/leases/expirations ──────────────────────────────────────────
export async function getLeaseExpirations(page = 1, perPage = 50): Promise<PaginatedResponse<LeaseExpiration>> {
  const limit = perPage;
  const offset = (page - 1) * perPage;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>('/api/v1/leases/expirations', { limit, offset });

  // DEBUG: log full raw response
  console.log('[CynthiaOS API] /api/v1/leases/expirations — raw response:', JSON.stringify(raw, null, 2));

  const { items, total } = extractArray(raw);
  // Filter out expired leases (days_until_expiration <= 0) — these are historical records
  const active = items.filter((r: any) => (r.days_until_expiration ?? 0) > 0);
  const mapped = active.map(mapLeaseExpiration);

  // DEBUG: log parsed output
  console.log('[CynthiaOS API] /api/v1/leases/expirations — parsed output:', { total, active: mapped.length, sample: mapped[0] });

  return {
    data: mapped,
    total: mapped.length,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(mapped.length / perPage)),
    limit,
    offset,
  };
}

// ─── GET /api/v1/leases/expiring-soon ────────────────────────────────────────
export async function getLeasesExpiringSoon(page = 1, perPage = 50): Promise<PaginatedResponse<LeaseExpiration>> {
  const limit = perPage;
  const offset = (page - 1) * perPage;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>('/api/v1/leases/expiring-soon', {
    limit,
    offset,
    days: QUERY_WINDOWS.expiringSoonDays,
  });

  // DEBUG: log full raw response
  console.log('[CynthiaOS API] /api/v1/leases/expiring-soon — raw response:', JSON.stringify(raw, null, 2));

  const { items, total } = extractArray(raw);
  const active = items.filter((r: any) => (r.days_until_expiration ?? 0) > 0);
  const mapped = active.map(mapLeaseExpiration);

  // DEBUG: log parsed output
  console.log('[CynthiaOS API] /api/v1/leases/expiring-soon — parsed output:', { total, active: mapped.length, sample: mapped[0] });

  return {
    data: mapped,
    total: mapped.length,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(mapped.length / perPage)),
    limit,
    offset,
  };
}

// ─── GET /api/v1/leases/upcoming-renewals ────────────────────────────────────
export async function getUpcomingRenewals(page = 1, perPage = 50): Promise<PaginatedResponse<UpcomingRenewal>> {
  const limit = perPage;
  const offset = (page - 1) * perPage;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>('/api/v1/leases/upcoming-renewals', {
    limit,
    offset,
    from_days: QUERY_WINDOWS.renewalFromDays,
    to_days: QUERY_WINDOWS.renewalToDays,
  });

  // DEBUG: log full raw response
  console.log('[CynthiaOS API] /api/v1/leases/upcoming-renewals — raw response:', JSON.stringify(raw, null, 2));

  const { items, total } = extractArray(raw);
  const mapped = items.map(mapUpcomingRenewal);

  // DEBUG: log parsed output
  console.log('[CynthiaOS API] /api/v1/leases/upcoming-renewals — parsed output:', { total, count: mapped.length, sample: mapped[0] });

  return {
    data: mapped,
    total,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
    limit,
    offset,
  };
}

// ─── Mock Data (isolated — NOT used in production flow) ───────────────────────
// Retained for local development reference only.
// To use mock data locally, import and call these functions directly in a dev-only context.

export const _MOCK_EXPIRATIONS: LeaseExpiration[] = [
  { id: 'lease-001', tenant_name: 'Marcus Delgado', unit: '4B', property: 'Sunridge Apartments', lease_end_date: '2026-04-08', days_until_expiration: 9, monthly_rent: 1850, contact_email: 'marcus.delgado@gmail.com', contact_phone: '(512) 334-7821', lease_type: 'Standard' },
  { id: 'lease-002', tenant_name: 'Priya Nair', unit: '12A', property: 'Elmwood Commons', lease_end_date: '2026-04-14', days_until_expiration: 15, monthly_rent: 2100, contact_email: 'p.nair@outlook.com', contact_phone: '(737) 882-0043', lease_type: 'Standard' },
  { id: 'lease-003', tenant_name: 'Jordan Whitfield', unit: '7C', property: 'Sunridge Apartments', lease_end_date: '2026-04-22', days_until_expiration: 23, monthly_rent: 1650, contact_email: 'jwhitfield@yahoo.com', contact_phone: '(512) 229-5511', lease_type: 'Month-to-Month' },
  { id: 'lease-004', tenant_name: 'Fatima Al-Hassan', unit: '3D', property: 'Brookfield Heights', lease_end_date: '2026-04-29', days_until_expiration: 30, monthly_rent: 2450, contact_email: 'fatima.alhassan@gmail.com', contact_phone: '(737) 441-9920', lease_type: 'Standard' },
  { id: 'lease-005', tenant_name: 'Terrence Okafor', unit: '9A', property: 'Elmwood Commons', lease_end_date: '2026-05-06', days_until_expiration: 37, monthly_rent: 1975, contact_email: 'tokafor@protonmail.com', contact_phone: '(512) 773-2284', lease_type: 'Standard' },
  { id: 'lease-006', tenant_name: 'Sabrina Castellano', unit: '2F', property: 'Brookfield Heights', lease_end_date: '2026-05-15', days_until_expiration: 46, monthly_rent: 2300, contact_email: 'scastellano@gmail.com', contact_phone: '(737) 556-1103', lease_type: 'Standard' },
  { id: 'lease-007', tenant_name: 'Devon Park', unit: '11B', property: 'Sunridge Apartments', lease_end_date: '2026-05-21', days_until_expiration: 52, monthly_rent: 1800, contact_email: 'devon.park@icloud.com', contact_phone: '(512) 990-4472', lease_type: 'Standard' },
  { id: 'lease-008', tenant_name: 'Ananya Krishnamurthy', unit: '6E', property: 'Elmwood Commons', lease_end_date: '2026-05-28', days_until_expiration: 59, monthly_rent: 2050, contact_email: 'ananya.k@gmail.com', contact_phone: '(737) 334-8801', lease_type: 'Month-to-Month' },
  { id: 'lease-009', tenant_name: 'Caleb Thornton', unit: '1A', property: 'Brookfield Heights', lease_end_date: '2026-06-05', days_until_expiration: 67, monthly_rent: 2650, contact_email: 'c.thornton@gmail.com', contact_phone: '(512) 112-3394', lease_type: 'Standard' },
  { id: 'lease-010', tenant_name: 'Mei-Ling Wu', unit: '8D', property: 'Sunridge Apartments', lease_end_date: '2026-06-12', days_until_expiration: 74, monthly_rent: 1900, contact_email: 'mwu@yahoo.com', contact_phone: '(737) 665-0092', lease_type: 'Standard' },
  { id: 'lease-011', tenant_name: 'Isaiah Fontaine', unit: '5C', property: 'Elmwood Commons', lease_end_date: '2026-06-19', days_until_expiration: 81, monthly_rent: 2200, contact_email: 'isaiah.f@gmail.com', contact_phone: '(512) 447-7823', lease_type: 'Standard' },
  { id: 'lease-012', tenant_name: 'Rosa Menendez', unit: '10B', property: 'Brookfield Heights', lease_end_date: '2026-06-27', days_until_expiration: 89, monthly_rent: 2400, contact_email: 'r.menendez@outlook.com', contact_phone: '(737) 220-5510', lease_type: 'Standard' },
];

export const _MOCK_RENEWALS: UpcomingRenewal[] = [
  { id: 'renewal-001', tenant_name: 'Priya Nair', unit: '12A', property: 'Elmwood Commons', renewal_date: '2026-04-14', days_until_renewal: 15, current_rent: 2100, proposed_rent: 2200, renewal_status: 'in_progress', contact_email: 'p.nair@outlook.com' },
  { id: 'renewal-002', tenant_name: 'Fatima Al-Hassan', unit: '3D', property: 'Brookfield Heights', renewal_date: '2026-04-29', days_until_renewal: 30, current_rent: 2450, proposed_rent: 2550, renewal_status: 'pending', contact_email: 'fatima.alhassan@gmail.com' },
  { id: 'renewal-003', tenant_name: 'Terrence Okafor', unit: '9A', property: 'Elmwood Commons', renewal_date: '2026-05-06', days_until_renewal: 37, current_rent: 1975, proposed_rent: 2075, renewal_status: 'pending', contact_email: 'tokafor@protonmail.com' },
  { id: 'renewal-004', tenant_name: 'Sabrina Castellano', unit: '2F', property: 'Brookfield Heights', renewal_date: '2026-05-15', days_until_renewal: 46, current_rent: 2300, proposed_rent: 2300, renewal_status: 'signed', contact_email: 'scastellano@gmail.com' },
  { id: 'renewal-005', tenant_name: 'Devon Park', unit: '11B', property: 'Sunridge Apartments', renewal_date: '2026-05-21', days_until_renewal: 52, current_rent: 1800, proposed_rent: 1950, renewal_status: 'in_progress', contact_email: 'devon.park@icloud.com' },
  { id: 'renewal-006', tenant_name: 'Ananya Krishnamurthy', unit: '6E', property: 'Elmwood Commons', renewal_date: '2026-05-28', days_until_renewal: 59, current_rent: 2050, proposed_rent: 2150, renewal_status: 'pending', contact_email: 'ananya.k@gmail.com' },
  { id: 'renewal-007', tenant_name: 'Caleb Thornton', unit: '1A', property: 'Brookfield Heights', renewal_date: '2026-06-05', days_until_renewal: 67, current_rent: 2650, proposed_rent: 2800, renewal_status: 'declined', contact_email: 'c.thornton@gmail.com' },
  { id: 'renewal-008', tenant_name: 'Mei-Ling Wu', unit: '8D', property: 'Sunridge Apartments', renewal_date: '2026-06-12', days_until_renewal: 74, current_rent: 1900, proposed_rent: 1975, renewal_status: 'pending', contact_email: 'mwu@yahoo.com' },
  { id: 'renewal-009', tenant_name: 'Isaiah Fontaine', unit: '5C', property: 'Elmwood Commons', renewal_date: '2026-06-19', days_until_renewal: 81, current_rent: 2200, proposed_rent: 2300, renewal_status: 'pending', contact_email: 'isaiah.f@gmail.com' },
  { id: 'renewal-010', tenant_name: 'Rosa Menendez', unit: '10B', property: 'Brookfield Heights', renewal_date: '2026-06-27', days_until_renewal: 89, current_rent: 2400, proposed_rent: 2500, renewal_status: 'signed', contact_email: 'r.menendez@outlook.com' },
];

// ─── Lease Actions API ────────────────────────────────────────────────────────

export interface LeaseActionsApiPayload {
  contacted: boolean;
  flagged: boolean;
  notes: string;
  last_action_at: string | null;
}

/** GET /api/v1/leases/:id/actions — fetch persisted actions from backend. */
export async function getLeaseActionsFromApi(leaseId: string): Promise<LeaseActionsApiPayload | null> {
  try {
    const raw = await fetchApi<LeaseActionsApiPayload>(`/api/v1/leases/${leaseId}/actions`);
    return raw ?? null;
  } catch (err) {
    console.warn('[CynthiaOS API] GET /api/v1/leases/:id/actions failed — falling back to localStorage:', err);
    return null;
  }
}

/** PUT /api/v1/leases/:id/actions — persist actions to backend. */
export async function putLeaseActionsToApi(
  leaseId: string,
  payload: LeaseActionsApiPayload
): Promise<LeaseActionsApiPayload | null> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_BASE;
  const url = `${API_BASE}/api/v1/leases/${leaseId}/actions`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn('[CynthiaOS API] PUT /api/v1/leases/:id/actions non-OK:', response.status, response.statusText);
      return null;
    }
    const json = await response.json();
    return json as LeaseActionsApiPayload;
  } catch (err) {
    console.warn('[CynthiaOS API] PUT /api/v1/leases/:id/actions failed — keeping local state:', err);
    return null;
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
// ─── INSIGHT + CORE ENDPOINTS (Phase 3) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Shared insight response wrapper ─────────────────────────────────────────
export interface InsightResponse<T> {
  success: boolean;
  total?: number;
  limit?: number;
  offset?: number;
  data: T[];
}

// ─── Portfolio Health ─────────────────────────────────────────────────────────
export interface PortfolioHealthBreakdown {
  score: number;
  weight: string;
  description: string;
}

export interface PortfolioHealthSupportingMetrics {
  occupancy_rate: number;
  vacancy_rate: number;
  net_operating_income: number;
  profit_margin: number;
  total_delinquency_balance: number;
  avg_aged_receivables_risk_score: number;
  high_expiration_risk_count: number;
}

export interface PortfolioHealth {
  success: boolean;
  portfolio_health_score: number;
  classification: string;
  breakdown: {
    financial: PortfolioHealthBreakdown;
    occupancy: PortfolioHealthBreakdown;
    risk: PortfolioHealthBreakdown;
  };
  supporting_metrics: PortfolioHealthSupportingMetrics;
  data_availability: {
    occupancy_data: boolean;
    financial_data: boolean;
    risk_data: boolean;
  };
}

export async function getPortfolioHealth(): Promise<PortfolioHealth> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/insights/portfolio-health');
}

// ─── At-Risk Revenue ──────────────────────────────────────────────────────────
export type UrgencyLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type AgingBucket = '0_30' | '31_60' | '61_90' | '90_plus';

export interface AtRiskTenant {
  tenant_id: string;
  full_name: string;
  unit_id: string;
  total_balance: number;
  risk_score: number;
  dominant_bucket: AgingBucket;
  delinquency_level: string | null;
  days_overdue: number | null;
  lease_end_date: string | null;
  days_until_expiration: number | null;
  urgency_level: UrgencyLevel;
}

export async function getAtRiskRevenue(urgency?: UrgencyLevel): Promise<InsightResponse<AtRiskTenant>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>('/api/v1/insights/at-risk-revenue', urgency ? { urgency } : undefined);
  return raw;
}

// ─── Collections Risk ─────────────────────────────────────────────────────────
export type CollectionsClassification =
  | 'Immediate Action'
  | 'High Priority'
  | 'Monitor'
  | 'Low Risk';

export interface CollectionsRiskTenant {
  tenant_id: string;
  full_name: string;
  unit_id: string;
  total_balance: number;
  risk_score: number;
  bucket_90_plus: number;
  dominant_bucket: AgingBucket;
  days_overdue: number | null;
  delinquency_level: string | null;
  lease_end_date: string | null;
  days_until_expiration: number | null;
  collections_risk_score: number;
  collections_classification: CollectionsClassification;
}

export async function getCollectionsRisk(
  classification?: CollectionsClassification
): Promise<InsightResponse<CollectionsRiskTenant>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>(
    '/api/v1/insights/collections-risk',
    classification ? { classification } : undefined
  );
  return raw;
}

// ─── Lease Expiration Risk ────────────────────────────────────────────────────
export type ExpirationRisk = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LeaseExpirationRiskItem {
  tenant_id: string;
  full_name: string;
  unit_id: string;
  lease_end_date: string;
  days_until_expiration: number;
  risk_score: number | null;
  days_overdue: number | null;
  delinquency_level: string | null;
  expiration_risk: ExpirationRisk;
}

export async function getLeaseExpirationRisk(
  risk?: ExpirationRisk,
  daysWindow?: number
): Promise<InsightResponse<LeaseExpirationRiskItem>> {
  const params: Record<string, string | number> = {};
  if (risk) params.risk = risk;
  if (daysWindow) params.days_window = daysWindow;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/insights/lease-expiration-risk', Object.keys(params).length ? params : undefined);
}

// ─── Turnover Velocity ────────────────────────────────────────────────────────
export type TurnoverClassification = 'High Churn' | 'Moderate' | 'Stable';

export interface TurnoverPortfolioSummary {
  total_turnover_events: number;
  units_with_turnover: number;
  total_units_tracked: number;
  avg_turnover_per_unit: number;
  stability_score: number;
  classification: string;
}

export interface TurnoverVelocityUnit {
  unit_id: string;
  number_of_move_ins: number;
  number_of_move_outs: number;
  turnover_count: number;
  first_event_date: string;
  last_event_date: string;
  stability_score: number;
  classification: TurnoverClassification;
}

export interface TurnoverVelocityResponse {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  portfolio: TurnoverPortfolioSummary;
  data: TurnoverVelocityUnit[];
}

export async function getTurnoverVelocity(): Promise<TurnoverVelocityResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/insights/turnover-velocity');
}

// ─── Delinquency ──────────────────────────────────────────────────────────────
export type DelinquencyRiskLevel = 'high' | 'medium' | 'low';

export interface DelinquencyRecord {
  id: string;
  bronze_report_id: string;
  tenant_id: string;
  unit_id: string;
  balance_due: number;
  days_overdue: number;
  risk_level: DelinquencyRiskLevel;
  created_at: string;
}

export async function getDelinquency(): Promise<InsightResponse<DelinquencyRecord>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/delinquency');
}

// ─── Aged Receivables ─────────────────────────────────────────────────────────
export interface AgedReceivableRecord {
  id: string;
  bronze_report_id: string;
  tenant_id: string;
  unit_id: string;
  total_balance: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  dominant_bucket: AgingBucket;
  risk_score: number;
  created_at: string;
}

export async function getAgedReceivables(): Promise<InsightResponse<AgedReceivableRecord>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/aged-receivables');
}

// ─── Income ───────────────────────────────────────────────────────────────────
export interface IncomeStatement {
  id: string;
  bronze_report_id: string;
  report_date: string;
  total_income: number;
  rental_income: number;
  other_income: number;
  total_expenses: number;
  operating_expenses: number;
  net_operating_income: number;
  profit_margin: number;
  created_at: string;
}

export async function getIncomeStatements(): Promise<InsightResponse<IncomeStatement>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/income');
}

// ─── Occupancy ────────────────────────────────────────────────────────────────
export interface OccupancySnapshot {
  id: string;
  bronze_report_id: string;
  report_date: string;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  occupancy_rate: number;
  vacancy_rate: number;
  created_at: string;
}

export async function getOccupancySnapshots(): Promise<InsightResponse<OccupancySnapshot>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/occupancy');
}

// ─── Turnover (raw Gold table) ────────────────────────────────────────────────
export type TurnoverEventType = 'move_in' | 'move_out';

export interface TurnoverEvent {
  id: string;
  bronze_report_id: string;
  tenant_id: string;
  unit_id: string;
  move_in_date: string | null;
  move_out_date: string | null;
  event_type: TurnoverEventType;
  created_at: string;
}

export async function getTurnoverEvents(): Promise<InsightResponse<TurnoverEvent>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/turnover');
}
