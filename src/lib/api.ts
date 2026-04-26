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
  unit_id?: string;
  property: string;
  lease_end_date: string;
  days_until_expiration: number;
  monthly_rent: number;
  contact_email: string;
  contact_phone: string;
  lease_type: string;
  unit_group: string | null;
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
  if (process.env.NODE_ENV === 'development') console.warn('[CynthiaOS API] Unknown response shape — could not extract array:', raw);
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
    property:              raw.property ?? raw.property_name ?? raw.propertyName ?? raw.building ?? '',
    lease_end_date:        raw.lease_end_date ?? raw.leaseEndDate ?? raw.end_date ?? raw.expiration_date ?? '',
    days_until_expiration: raw.days_until_expiration ?? raw.daysUntilExpiration ?? raw.days_remaining ?? raw.days_left ?? 0,
    monthly_rent:          raw.monthly_rent ?? raw.monthlyRent ?? raw.scheduled_rent ?? raw.market_rent ?? raw.rent ?? raw.rent_amount ?? 0,
    contact_email:         raw.contact_email ?? raw.contactEmail ?? raw.email ?? '',
    contact_phone:         (raw.contact_phone || raw.contactPhone || raw.phone || raw.phone_number || '').trim(),
    lease_type:            raw.lease_type ?? raw.leaseType ?? raw.type ?? '',
    unit_group:            raw.unit_group ?? null,
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
    proposed_rent:    raw.proposed_rent ?? raw.proposedRent ?? raw.new_rent ?? null,
    renewal_status:   raw.renewal_status ?? raw.renewalStatus ?? raw.status,
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
    if (process.env.NODE_ENV === 'development') console.log('[CynthiaOS API] Raw proxy response for', endpoint, '— length check:',
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

  const { items, total } = extractArray(raw);
  // Filter out expired leases (days_until_expiration <= 0) — these are historical records
  const active = items.filter((r: any) => (r.days_until_expiration ?? 0) > 0);
  const mapped = active.map(mapLeaseExpiration);

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

  const { items, total } = extractArray(raw);
  const active = items.filter((r: any) => (r.days_until_expiration ?? 0) > 0);
  const mapped = active.map(mapLeaseExpiration);

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

  const { items, total } = extractArray(raw);
  const mapped = items.map(mapUpcomingRenewal);

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
    // API returns { success: true, data: { contacted, flagged, notes, last_action_at } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchApi<any>(`/api/v1/leases/${leaseId}/actions`);
    // Unwrap envelope if present
    const payload = raw?.data ?? raw;
    if (!payload || typeof payload !== 'object') return null;
    return payload as LeaseActionsApiPayload;
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
    // Unwrap envelope if present: { success: true, data: {...} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unwrapped = (json as any)?.data ?? json;
    return unwrapped as LeaseActionsApiPayload;
  } catch (err) {
    console.warn('[CynthiaOS API] PUT /api/v1/leases/:id/actions failed — keeping local state:', err);
    return null;
  }
}

// ─── Unit Notes ─────────────────────────────────────────────────────────────

export interface UnitNotePayload {
  notes: string;
  contacted: boolean;
  flagged: boolean;
  updated_at: string | null;
  source: 'unit_notes' | 'lease_actions' | null;
}

/** GET /api/v1/units/:id/notes — fetch persisted note for a unit. */
export async function getUnitNotes(unitId: string): Promise<UnitNotePayload | null> {
  try {
    const raw = await fetchApi<UnitNotePayload>(`/api/v1/units/${encodeURIComponent(unitId)}/notes`);
    return raw ?? null;
  } catch (err) {
    console.warn('[CynthiaOS API] GET /api/v1/units/:id/notes failed:', err);
    return null;
  }
}

/** PUT /api/v1/units/:id/notes — persist notes, contacted, and/or flagged for a unit. */
export async function putUnitNotes(
  unitId: string,
  payload: { notes?: string; contacted?: boolean; flagged?: boolean }
): Promise<{ unit_id: string; notes: string; contacted: boolean; flagged: boolean; updated_at: string } | null> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_BASE;
  const url = `${API_BASE}/api/v1/units/${encodeURIComponent(unitId)}/notes`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn('[CynthiaOS API] PUT /api/v1/units/:id/notes non-OK:', response.status, response.statusText);
      return null;
    }
    const json = await response.json();
    return json.data ?? null;
  } catch (err) {
    console.warn('[CynthiaOS API] PUT /api/v1/units/:id/notes failed:', err);
    return null;
  }
}

// ─── Renewal Tracking ────────────────────────────────────────────────────────

export interface RenewalRecord {
  id: string;
  unit_id: string;
  tenant_id: string;
  tenant_name: string;
  lease_end_date: string;
  days_until_expiration: number;
  current_rent: number | null;
  proposed_rent: number | null;
  renewal_status: 'pending' | 'in_progress' | 'signed' | 'declined';
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  tracking_updated_at: string | null;
}

export interface RenewalUpdatePayload {
  renewal_status?: 'pending' | 'in_progress' | 'signed' | 'declined';
  proposed_rent?: number | null;
  notes?: string | null;
}

/** GET /api/v1/renewals — fetch upcoming leases with renewal tracking data. */
export async function getRenewals(
  fromDays = 0,
  toDays = 365,
  limit = 100,
  offset = 0
): Promise<{ data: RenewalRecord[]; total: number }> {
  try {
    const raw = await fetchApi<{ data: RenewalRecord[]; total: number }>('/api/v1/renewals', {
      from_days: fromDays,
      to_days: toDays,
      limit,
      offset,
    });
    return { data: raw?.data ?? [], total: raw?.total ?? 0 };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CynthiaOS API] GET /api/v1/renewals failed:', err);
    }
    return { data: [], total: 0 };
  }
}

/** PUT /api/v1/renewals/:unit_id — upsert renewal tracking for a unit. */
export async function updateRenewal(
  unitId: string,
  payload: RenewalUpdatePayload
): Promise<boolean> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cynthiaos-api-production.up.railway.app';
  const url = `${API_BASE}/api/v1/renewals/${encodeURIComponent(unitId)}`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CynthiaOS API] PUT /api/v1/renewals/:unit_id failed:', err);
    }
    return false;
  }
}


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
  total_units: number | null;
  occupied_units: number | null;
  vacant_units: number | null;
  notice_units: number | null;
  occupancy_rate: number | null;
  vacancy_rate: number | null;
  net_operating_income: number;
  profit_margin: number | null;
  gross_revenue: number | null;
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
    expense_data: boolean;
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
  tenant_status: 'current' | 'past';
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
  const params: Record<string, string | number> = { limit: 100 };
  if (classification) params.classification = classification;
  const raw = await fetchApi<any>('/api/v1/insights/collections-risk', params);
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
  const params: Record<string, string | number> = { limit: 200 };
  if (risk) params.risk = risk;
  if (daysWindow) params.days_window = daysWindow;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/insights/lease-expiration-risk', params);
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
  // YTD fields
  total_income: number;
  rental_income: number;
  other_income: number;
  total_expenses: number;
  operating_expenses: number;
  net_operating_income: number;
  profit_margin: number | null;
  // MTD fields
  total_income_mtd: number;
  rental_income_mtd: number;
  other_income_mtd: number;
  total_expenses_mtd: number;
  operating_expenses_mtd: number;
  net_operating_income_mtd: number;
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


/** Lightweight count-only fetch for expiring leases within N days */
export async function getExpiringCount(days: number): Promise<{ total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchApi<any>('/api/v1/leases/expiring-soon', { days, limit: 1 });
  return { total: raw?.total ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── LEASING FUNNEL ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface LeasingFunnelStage {
  stage: string;
  count: number;
  conversion_from_prev: number | null;   // % that converted from prior stage
  drop_off_from_prev: number | null;     // can be negative when leases > apps
  conversion_from_leads: number | null;  // % relative to total leads
}

export interface LeasingFunnelPeriod {
  period: string;           // "2026-01"
  period_label: string;     // "Jan 2026"
  leads: number;
  applications: number;
  leases: number;
  lead_to_app_pct: number;
  app_to_lease_pct: number; // NOTE: can exceed 100 — lease_history includes
                            // renewals/offline leases that skip formal apps
  lead_to_lease_pct: number;
}

export interface LeasingFunnelSummary {
  total_leads: number;
  total_applications: number;
  total_leases: number;
  lead_to_app_pct: number;
  app_to_lease_pct: number; // NOTE: can exceed 100 (see above)
  lead_to_lease_pct: number;
  period_from: string;
  period_to: string;
}

export interface LeasingFunnelResponse {
  success: boolean;
  summary: LeasingFunnelSummary;
  funnel: LeasingFunnelStage[];
  trend: LeasingFunnelPeriod[];
}

/**
 * GET /api/v1/insights/leasing-funnel
 * Derived from Bronze AppFolio reports: guest_cards, rental_applications,
 * lease_history. app_to_lease_pct can exceed 100% — lease_history includes
 * renewals and offline leases that bypass the formal application stage.
 */
export async function getLeasingFunnel(
  from?: string,
  to?: string
): Promise<LeasingFunnelResponse> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fetchApi<any>('/api/v1/insights/leasing-funnel', params);
}
