import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const APPFOLIO_BASE_URL = "https://cynthiagardens.appfolio.com/api/v1/reports";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const POLL_MAX_ATTEMPTS = Number(process.env.POLL_MAX_ATTEMPTS ?? 36);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 30000);
const INTER_REQUEST_DELAY_MS = Number(process.env.INTER_REQUEST_DELAY_MS ?? 1000);
const SOURCE_MATERIALITY_ABS = Number(process.env.SOURCE_MATERIALITY_ABS ?? 1);
const SOURCE_MATERIALITY_PCT = Number(process.env.SOURCE_MATERIALITY_PCT ?? 0.01);

const VERDICTS = ["NAMING_MISMATCH", "SOURCE_NARROW", "BRONZE_COUNT_UNRESOLVED", "PROMOTION_STALLED", "CLEAN"] as const;
type Verdict = typeof VERDICTS[number];

type Sql = postgres.Sql;

type ReportCatalogueEntry = {
  id: string;
  url: string;
  reportDate: string;
};

type GoldMapping = {
  table: string;
  countColumn?: string;
  dateColumn?: string;
  timestampColumn?: string;
  whereReportDateColumn?: string;
};

type BronzeSnapshot = {
  count: number | null;
  latestDate: string | null;
  ingestedAt: string | null;
  countSourceKey: string;
};

type SilverSnapshot = {
  count: number | null;
  latestDate: string | null;
  transformedAt: string | null;
};

type GoldSnapshot = {
  count: number | null;
  latestDate: string | null;
};

type ParityRow = {
  report_type: string;
  registry_report_type: string | null;
  appfolio_source_count: number | null;
  bronze_count: number | null;
  silver_count: number | null;
  gold_count: number | null;
  bronze_latest_date: string | null;
  gold_latest_date: string | null;
  lag_days: number | null;
  verdict: Verdict;
  env: string;
  notes: string[];
};

const DEFAULT_REGISTRY_PATH = path.resolve(process.cwd(), "../cynthiaos-transform-worker/src/strategies/registry.ts");
const REGISTRY_PATH = process.env.TRANSFORM_REGISTRY_PATH ?? DEFAULT_REGISTRY_PATH;

const MAINTENANCE_REPORT_TYPES = new Set(["work_order"]);

// Gold lookup override only. This must not participate in NAMING_MISMATCH detection;
// mismatch detection is anchored to the real transform registry loaded at runtime.
const FETCH_TO_REGISTRY_ALIASES: Record<string, string> = {
  aged_receivables_detail: "aged_receivables",
};

const GOLD_MAPPINGS: Record<string, GoldMapping[]> = {
  rent_roll: [
    { table: "gold_units", dateColumn: "report_date" },
    { table: "gold_lease_expirations", dateColumn: "report_date" },
  ],
  delinquency: [{ table: "gold_delinquency_records", dateColumn: "report_date" }],
  aged_receivables: [{ table: "gold_aged_receivables", dateColumn: "report_date", timestampColumn: "updated_at" }],
  tenant_directory: [{ table: "gold_tenants", timestampColumn: "updated_at" }],
  income_statement: [{ table: "gold_income_statements", dateColumn: "report_date" }],
  unit_directory: [{ table: "gold_units", dateColumn: "report_date" }],
  unit_vacancy: [{ table: "gold_occupancy_snapshots", dateColumn: "report_date" }],
  occupancy_summary: [{ table: "gold_occupancy_snapshots", dateColumn: "report_date" }],
  unit_turn_detail: [{ table: "gold_unit_turns", dateColumn: "report_date" }],
  move_in_move_out: [{ table: "gold_move_in_move_out", dateColumn: "report_date" }],
  rental_applications: [{ table: "gold_rental_applications", dateColumn: "report_date" }],
  general_ledger: [{ table: "gold_general_ledger", dateColumn: "report_date" }],
  vendor_directory: [{ table: "gold_vendors", timestampColumn: "updated_at" }],
  guest_cards: [{ table: "gold_prospects", dateColumn: "report_date" }],
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

function assertEnvironmentGate(): string {
  const env = process.env.CYNTHIAOS_ENV;
  if (!env) {
    throw new Error("CYNTHIAOS_ENV is required; set it explicitly to dev, staging, production, or prod before running this job.");
  }
  const normalized = env.trim().toLowerCase();
  const allowed = new Set(["dev", "development", "staging", "stage", "prod", "production"]);
  if (!allowed.has(normalized)) {
    throw new Error(`Unsupported CYNTHIAOS_ENV=${env}. Refusing to run without an explicit dev/staging/prod environment gate.`);
  }
  return normalized;
}

function getPooledDb(): Sql {
  return postgres(requireEnv("DATABASE_URL"), { ssl: "require", max: 5, idle_timeout: 30 });
}

function getDirectDb(): Sql {
  return postgres(requireEnv("DATABASE_DIRECT_URL"), { ssl: "require", max: 1, idle_timeout: 30 });
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDateParams() {
  const today = new Date();
  const jan1 = new Date(today.getFullYear(), 0, 1);
  const t12Start = new Date(today);
  t12Start.setFullYear(t12Start.getFullYear() - 1);
  const fwdEnd = new Date(today);
  fwdEnd.setFullYear(fwdEnd.getFullYear() + 1);
  return { today: toISO(today), jan1: toISO(jan1), t12Start: toISO(t12Start), fwdEnd: toISO(fwdEnd) };
}

function buildReportCatalogue(): ReportCatalogueEntry[] {
  const { today, jan1, t12Start, fwdEnd } = getDateParams();
  const ytd = `from_date=${jan1}&to_date=${today}`;
  const t12 = `from_date=${t12Start}&to_date=${today}`;
  const fwd = `from_date=${today}&to_date=${fwdEnd}`;
  const asof = `as_of_date=${today}`;

  return [
    { id: "rent_roll", url: `${APPFOLIO_BASE_URL}/rent_roll`, reportDate: today },
    { id: "rent_roll_itemized", url: `${APPFOLIO_BASE_URL}/rent_roll_itemized`, reportDate: today },
    { id: "delinquency", url: `${APPFOLIO_BASE_URL}/delinquency`, reportDate: today },
    { id: "aged_receivables_detail", url: `${APPFOLIO_BASE_URL}/aged_receivables_detail`, reportDate: today },
    { id: "unit_vacancy", url: `${APPFOLIO_BASE_URL}/unit_vacancy`, reportDate: today },
    { id: "tenant_directory", url: `${APPFOLIO_BASE_URL}/tenant_directory`, reportDate: today },
    { id: "owner_directory", url: `${APPFOLIO_BASE_URL}/owner_directory`, reportDate: today },
    { id: "property_directory", url: `${APPFOLIO_BASE_URL}/property_directory`, reportDate: today },
    { id: "vendor_directory", url: `${APPFOLIO_BASE_URL}/vendor_directory`, reportDate: today },
    { id: "unit_directory", url: `${APPFOLIO_BASE_URL}/unit_directory`, reportDate: today },
    { id: "balance_sheet", url: `${APPFOLIO_BASE_URL}/balance_sheet?${asof}`, reportDate: today },
    { id: "trial_balance", url: `${APPFOLIO_BASE_URL}/trial_balance?${ytd}`, reportDate: today },
    { id: "cash_flow", url: `${APPFOLIO_BASE_URL}/cash_flow?${ytd}`, reportDate: today },
    { id: "income_statement", url: `${APPFOLIO_BASE_URL}/income_statement?${ytd}`, reportDate: today },
    { id: "general_ledger", url: `${APPFOLIO_BASE_URL}/general_ledger?${ytd}`, reportDate: today },
    { id: "check_register_detail", url: `${APPFOLIO_BASE_URL}/check_register_detail?${ytd}`, reportDate: today },
    { id: "deposit_register", url: `${APPFOLIO_BASE_URL}/deposit_register?${ytd}`, reportDate: today },
    { id: "charge_detail", url: `${APPFOLIO_BASE_URL}/charge_detail?${ytd}`, reportDate: today },
    { id: "receivables_activity", url: `${APPFOLIO_BASE_URL}/receivables_activity?${ytd}`, reportDate: today },
    { id: "lease_history", url: `${APPFOLIO_BASE_URL}/lease_history?${ytd}`, reportDate: today },
    { id: "unit_turn_detail", url: `${APPFOLIO_BASE_URL}/unit_turn_detail?${ytd}`, reportDate: today },
    { id: "move_in_move_out", url: `${APPFOLIO_BASE_URL}/move_in_move_out?${ytd}`, reportDate: today },
    { id: "renewal_summary", url: `${APPFOLIO_BASE_URL}/renewal_summary?${ytd}`, reportDate: today },
    { id: "prospect_source_tracking", url: `${APPFOLIO_BASE_URL}/prospect_source_tracking?${ytd}`, reportDate: today },
    { id: "guest_cards", url: `${APPFOLIO_BASE_URL}/guest_cards?${ytd}`, reportDate: today },
    { id: "rental_applications", url: `${APPFOLIO_BASE_URL}/rental_applications?${ytd}`, reportDate: today },
    { id: "work_order", url: `${APPFOLIO_BASE_URL}/work_order`, reportDate: today },
    { id: "twelve_month_cash_flow", url: `${APPFOLIO_BASE_URL}/twelve_month_cash_flow?${t12}`, reportDate: today },
    { id: "twelve_month_income_statement", url: `${APPFOLIO_BASE_URL}/twelve_month_income_statement?${t12}`, reportDate: today },
    { id: "lease_expiration_detail", url: `${APPFOLIO_BASE_URL}/lease_expiration_detail?${fwd}`, reportDate: today },
  ];
}

function canonicalRegistryType(fetchType: string): string {
  return FETCH_TO_REGISTRY_ALIASES[fetchType] ?? fetchType;
}

async function loadRegisteredStrategyTypes(registryPath = REGISTRY_PATH): Promise<Set<string>> {
  let source: string;
  try {
    source = await fs.readFile(registryPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to load transform registry source at ${registryPath}: ${message}`);
  }

  const registryObject = source.match(/const\s+TRANSFORM_STRATEGIES\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)^\};/m);
  if (!registryObject) {
    throw new Error(`Unable to parse TRANSFORM_STRATEGIES from ${registryPath}; refusing to use a fallback registry list.`);
  }

  const registryBody = registryObject[1];
  if (!registryBody) {
    throw new Error(`TRANSFORM_STRATEGIES body was empty in ${registryPath}; refusing to use a fallback registry list.`);
  }

  const bodyWithoutLineComments = registryBody.replace(/\/\/.*$/gm, "");
  const keys = new Set<string>();
  const quotedKey = /["']([A-Za-z0-9_]+)["']\s*:/g;
  const bareKey = /(?:^|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  for (const match of bodyWithoutLineComments.matchAll(quotedKey)) {
    const key = match[1];
    if (key) keys.add(key);
  }
  for (const match of bodyWithoutLineComments.matchAll(bareKey)) {
    const key = match[1];
    if (key) keys.add(key);
  }

  if (keys.size === 0) {
    throw new Error(`Parsed zero registered transform strategies from ${registryPath}; refusing to continue.`);
  }
  return keys;
}

function isInScope(fetchType: string, registeredStrategyTypes: Set<string>): boolean {
  if (MAINTENANCE_REPORT_TYPES.has(fetchType)) return false;
  const goldLookupType = canonicalRegistryType(fetchType);
  return registeredStrategyTypes.has(fetchType) || registeredStrategyTypes.has(goldLookupType);
}

function authHeader(): string {
  const id = requireEnv("APPFOLIO_CLIENT_ID");
  const secret = requireEnv("APPFOLIO_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["results", "rows", "data", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

async function fetchJson(url: string): Promise<{ status: number; payload: unknown; location: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: authHeader(), Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw_text: text };
      }
    }
    return { status: response.status, payload, location: response.headers.get("location") };
  } finally {
    clearTimeout(timer);
  }
}

function resolvePollUrl(location: string): string {
  if (/^https?:\/\//i.test(location)) return location;
  return new URL(location, APPFOLIO_BASE_URL).toString();
}

async function fetchAppFolioCount(entry: ReportCatalogueEntry): Promise<number | null> {
  const first = await fetchJson(entry.url);
  if (first.status === 200) return extractRows(first.payload).length;
  if (first.status !== 202) {
    throw new Error(`AppFolio ${entry.id} returned HTTP ${first.status}`);
  }

  let pollUrl = first.location;
  if (!pollUrl && first.payload && typeof first.payload === "object") {
    const obj = first.payload as Record<string, unknown>;
    const candidate = obj.location ?? obj.url ?? obj.poll_url ?? obj.status_url;
    if (typeof candidate === "string") pollUrl = candidate;
  }
  if (!pollUrl) throw new Error(`AppFolio ${entry.id} returned 202 without a poll URL`);

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const polled = await fetchJson(resolvePollUrl(pollUrl));
    if (polled.status === 200) return extractRows(polled.payload).length;
    if (polled.status !== 202) throw new Error(`AppFolio ${entry.id} poll returned HTTP ${polled.status}`);
  }
  throw new Error(`AppFolio ${entry.id} polling exceeded ${POLL_MAX_ATTEMPTS} attempts`);
}

async function ensurePipelineHealthTable(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS pipeline_health (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      report_type text NOT NULL,
      run_at timestamptz NOT NULL DEFAULT NOW(),
      appfolio_source_count integer,
      bronze_count integer,
      silver_count integer,
      gold_count integer,
      bronze_latest_date date,
      gold_latest_date date,
      lag_days integer,
      verdict text NOT NULL,
      env text NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pipeline_health_report_type_run_at ON pipeline_health (report_type, run_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pipeline_health_verdict_run_at ON pipeline_health (verdict, run_at DESC)`;
}

async function queryBronze(sql: Sql, reportType: string): Promise<BronzeSnapshot> {
  const rows = await sql<Array<{ row_count: number | null; latest_date: string | null; ingested_at: string | null; count_source_key: string | null }>>`
    WITH latest AS (
      SELECT report_date, raw_data, ingested_at
      FROM bronze_appfolio_reports
      WHERE report_type = ${reportType}
      ORDER BY report_date DESC NULLS LAST, ingested_at DESC NULLS LAST
      LIMIT 1
    ), object_entries AS (
      SELECT
        latest.report_date,
        latest.raw_data,
        latest.ingested_at,
        entry.key,
        entry.value,
        COUNT(entry.key) OVER () AS top_level_key_count
      FROM latest
      LEFT JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(latest.raw_data) = 'object' THEN latest.raw_data ELSE '{}'::jsonb END
      ) AS entry(key, value) ON TRUE
    ), detected AS (
      SELECT
        report_date,
        raw_data,
        ingested_at,
        CASE
          WHEN jsonb_typeof(raw_data) = 'array' THEN 'raw_data'
          WHEN jsonb_typeof(raw_data -> 'results') = 'array' THEN 'results'
          WHEN jsonb_typeof(raw_data -> 'rows') = 'array' THEN 'rows'
          WHEN jsonb_typeof(raw_data -> 'data') = 'array' THEN 'data'
          WHEN jsonb_typeof(raw_data -> 'items') = 'array' THEN 'items'
          WHEN MAX(top_level_key_count) = 1 AND MAX(jsonb_typeof(value)) = 'array' THEN MAX(key)
          ELSE 'unknown'
        END AS count_source_key
      FROM object_entries
      GROUP BY report_date, raw_data, ingested_at
    )
    SELECT
      CASE
        WHEN count_source_key = 'raw_data' THEN jsonb_array_length(raw_data)
        WHEN count_source_key IN ('results', 'rows', 'data', 'items') THEN jsonb_array_length(raw_data -> count_source_key)
        WHEN count_source_key NOT IN ('unknown', 'raw_data', 'results', 'rows', 'data', 'items') THEN jsonb_array_length(raw_data -> count_source_key)
        ELSE NULL
      END::integer AS row_count,
      report_date::text AS latest_date,
      ingested_at::text AS ingested_at,
      count_source_key
    FROM detected
  `;
  const row = rows[0];
  return {
    count: row?.row_count ?? null,
    latestDate: row?.latest_date ?? null,
    ingestedAt: row?.ingested_at ?? null,
    countSourceKey: row?.count_source_key ?? "unknown",
  };
}

async function querySilver(sql: Sql, reportType: string): Promise<SilverSnapshot> {
  const rows = await sql<Array<{ row_count: number | null; latest_date: string | null; transformed_at: string | null }>>`
    WITH latest AS (
      SELECT report_date, normalized_data, transformed_at
      FROM silver_appfolio_reports
      WHERE report_type = ${reportType}
      ORDER BY report_date DESC NULLS LAST, transformed_at DESC NULLS LAST
      LIMIT 1
    )
    SELECT
      CASE
        WHEN jsonb_typeof(normalized_data -> 'rows') = 'array' THEN jsonb_array_length(normalized_data -> 'rows')
        WHEN jsonb_typeof(normalized_data -> 'units') = 'array' THEN jsonb_array_length(normalized_data -> 'units')
        WHEN jsonb_typeof(normalized_data -> 'records') = 'array' THEN jsonb_array_length(normalized_data -> 'records')
        WHEN jsonb_typeof(normalized_data -> 'summary') = 'object' THEN 1
        WHEN jsonb_typeof(normalized_data) = 'array' THEN jsonb_array_length(normalized_data)
        ELSE NULL
      END::integer AS row_count,
      report_date::text AS latest_date,
      transformed_at::text AS transformed_at
    FROM latest
  `;
  const row = rows[0];
  return { count: row?.row_count ?? null, latestDate: row?.latest_date ?? null, transformedAt: row?.transformed_at ?? null };
}

async function tableExists(sql: Sql, tableName: string): Promise<boolean> {
  const rows = await sql<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ${tableName}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function columnExists(sql: Sql, tableName: string, columnName: string): Promise<boolean> {
  const rows = await sql<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}

async function queryGoldOne(sql: Sql, mapping: GoldMapping): Promise<GoldSnapshot> {
  if (!(await tableExists(sql, mapping.table))) return { count: null, latestDate: null };

  const dateColumn = mapping.dateColumn && await columnExists(sql, mapping.table, mapping.dateColumn) ? mapping.dateColumn : null;
  const timestampColumn = mapping.timestampColumn && await columnExists(sql, mapping.table, mapping.timestampColumn) ? mapping.timestampColumn : null;

  if (dateColumn) {
    const rows = await sql<Array<{ row_count: number; latest_date: string | null }>>`
      SELECT COUNT(*)::integer AS row_count, MAX(${sql(dateColumn)})::date::text AS latest_date
      FROM ${sql(mapping.table)}
    `;
    return { count: rows[0]?.row_count ?? null, latestDate: rows[0]?.latest_date ?? null };
  }

  if (timestampColumn) {
    const rows = await sql<Array<{ row_count: number; latest_date: string | null }>>`
      SELECT COUNT(*)::integer AS row_count, MAX(${sql(timestampColumn)})::date::text AS latest_date
      FROM ${sql(mapping.table)}
    `;
    return { count: rows[0]?.row_count ?? null, latestDate: rows[0]?.latest_date ?? null };
  }

  const rows = await sql<Array<{ row_count: number }>>`SELECT COUNT(*)::integer AS row_count FROM ${sql(mapping.table)}`;
  return { count: rows[0]?.row_count ?? null, latestDate: null };
}

async function queryGold(sql: Sql, registryType: string): Promise<GoldSnapshot> {
  const mappings = GOLD_MAPPINGS[registryType] ?? [];
  if (mappings.length === 0) return { count: null, latestDate: null };

  const snapshots: GoldSnapshot[] = [];
  for (const mapping of mappings) {
    snapshots.push(await queryGoldOne(sql, mapping));
  }

  const counts = snapshots.map((s) => s.count).filter((v): v is number => typeof v === "number");
  const dates = snapshots.map((s) => s.latestDate).filter((v): v is string => typeof v === "string" && v.length > 0).sort();
  const latestDate = dates.length === 0 ? null : dates[dates.length - 1] ?? null;
  return {
    count: counts.length === 0 ? null : Math.max(...counts),
    latestDate,
  };
}

function daysBetween(older: string | null, newer: string | null): number | null {
  if (!older || !newer) return null;
  const olderDate = new Date(`${older.slice(0, 10)}T00:00:00Z`);
  const newerDate = new Date(`${newer.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(olderDate.getTime()) || Number.isNaN(newerDate.getTime())) return null;
  return Math.floor((newerDate.getTime() - olderDate.getTime()) / 86400000);
}

function materiallyGreater(source: number | null, bronze: number | null): boolean {
  if (source === null || bronze === null) return false;
  const delta = source - bronze;
  const threshold = Math.max(SOURCE_MATERIALITY_ABS, Math.ceil(source * SOURCE_MATERIALITY_PCT));
  return delta > threshold;
}

function deriveVerdict(args: {
  fetchType: string;
  registryType: string;
  sourceCount: number | null;
  bronzeCount: number | null;
  bronzeCountSourceKey: string;
  goldCount: number | null;
  bronzeLatestDate: string | null;
  goldLatestDate: string | null;
  toleranceDays: number;
  isRegisteredFetchType: boolean;
}): { verdict: Verdict; lagDays: number | null; notes: string[] } {
  const notes: string[] = [];
  const lagDays = daysBetween(args.goldLatestDate, args.bronzeLatestDate);
  notes.push(`Bronze row count source key: ${args.bronzeCountSourceKey}.`);

  if (!args.isRegisteredFetchType) {
    notes.push(`Fetch catalogue id '${args.fetchType}' has no matching registered strategy key in the real transform registry; Gold lookup uses '${args.registryType}'.`);
    return { verdict: "NAMING_MISMATCH", lagDays, notes };
  }

  if (args.sourceCount !== null && args.bronzeCount === null) {
    notes.push("Bronze row count unresolved (raw_data shape not recognized); SOURCE_NARROW could not be evaluated.");
    return { verdict: "BRONZE_COUNT_UNRESOLVED", lagDays, notes };
  }

  if (materiallyGreater(args.sourceCount, args.bronzeCount)) {
    notes.push("AppFolio source count materially exceeds the latest Bronze payload count.");
    return { verdict: "SOURCE_NARROW", lagDays, notes };
  }

  const countStalled = args.bronzeCount !== null && args.goldCount !== null && args.bronzeCount > args.goldCount;
  const dateStalled = lagDays !== null && lagDays > args.toleranceDays;
  if (countStalled || dateStalled) {
    if (countStalled) notes.push("Latest Bronze payload row count exceeds mapped Gold row count.");
    if (dateStalled) notes.push(`Gold latest date lags Bronze latest date by ${lagDays} days, above tolerance ${args.toleranceDays}.`);
    return { verdict: "PROMOTION_STALLED", lagDays, notes };
  }

  notes.push("Counts and freshness are within configured parity tolerance.");
  return { verdict: "CLEAN", lagDays, notes };
}

async function insertHealthRows(sql: Sql, rows: ParityRow[], runAt: Date): Promise<void> {
  for (const row of rows) {
    await sql`
      INSERT INTO pipeline_health (
        report_type,
        run_at,
        appfolio_source_count,
        bronze_count,
        silver_count,
        gold_count,
        bronze_latest_date,
        gold_latest_date,
        lag_days,
        verdict,
        env
      ) VALUES (
        ${row.report_type},
        ${runAt.toISOString()},
        ${row.appfolio_source_count},
        ${row.bronze_count},
        ${row.silver_count},
        ${row.gold_count},
        ${row.bronze_latest_date},
        ${row.gold_latest_date},
        ${row.lag_days},
        ${row.verdict},
        ${row.env}
      )
    `;
  }
}

function printTable(rows: ParityRow[]): void {
  const printable = rows.map((row) => ({
    report_type: row.report_type,
    registry_type: row.registry_report_type ?? "",
    appfolio_source_count: row.appfolio_source_count ?? "ERR",
    bronze_count: row.bronze_count ?? "NULL",
    silver_count: row.silver_count ?? "NULL",
    gold_count: row.gold_count ?? "NULL",
    bronze_latest_date: row.bronze_latest_date ?? "NULL",
    gold_latest_date: row.gold_latest_date ?? "NULL",
    lag_days: row.lag_days ?? "NULL",
    verdict: row.verdict,
  }));
  console.table(printable);
  for (const row of rows) {
    if (row.notes.length > 0) console.log(`${row.report_type} notes: ${row.notes.join(" | ")}`);
  }
}

async function main(): Promise<void> {
  const env = assertEnvironmentGate();
  const lagToleranceDays = Number(process.env.LAG_DAYS_TOLERANCE ?? 2);
  if (!Number.isFinite(lagToleranceDays) || lagToleranceDays < 0) {
    throw new Error("LAG_DAYS_TOLERANCE must be a non-negative number of days.");
  }

  const runAt = new Date();
  const directSql = getDirectDb();
  const pooledSql = getPooledDb();
  const rows: ParityRow[] = [];

  try {
    await ensurePipelineHealthTable(directSql);

    const registeredStrategyTypes = await loadRegisteredStrategyTypes();
    const catalogue = buildReportCatalogue().filter((entry) => isInScope(entry.id, registeredStrategyTypes));
    const prioritized = catalogue.sort((a, b) => {
      const rank = (id: string) => id === "aged_receivables_detail" ? 0 : id === "tenant_directory" ? 1 : 2;
      return rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);
    });

    for (const entry of prioritized) {
      const registryType = canonicalRegistryType(entry.id);
      const notes: string[] = [];
      let sourceCount: number | null = null;
      try {
        sourceCount = await fetchAppFolioCount(entry);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        notes.push(`AppFolio source count failed: ${message}`);
      }

      const bronze = await queryBronze(pooledSql, entry.id);
      const silver = await querySilver(pooledSql, entry.id);
      const gold = await queryGold(pooledSql, registryType);
      const verdictResult = deriveVerdict({
        fetchType: entry.id,
        registryType,
        sourceCount,
        bronzeCount: bronze.count,
        bronzeCountSourceKey: bronze.countSourceKey,
        goldCount: gold.count,
        bronzeLatestDate: bronze.latestDate,
        goldLatestDate: gold.latestDate,
        toleranceDays: lagToleranceDays,
        isRegisteredFetchType: registeredStrategyTypes.has(entry.id) || registeredStrategyTypes.has(registryType),
      });

      rows.push({
        report_type: entry.id,
        registry_report_type: registryType,
        appfolio_source_count: sourceCount,
        bronze_count: bronze.count,
        silver_count: silver.count,
        gold_count: gold.count,
        bronze_latest_date: bronze.latestDate,
        gold_latest_date: gold.latestDate,
        lag_days: verdictResult.lagDays,
        verdict: verdictResult.verdict,
        env,
        notes: [...notes, ...verdictResult.notes],
      });

      if (INTER_REQUEST_DELAY_MS > 0) await sleep(INTER_REQUEST_DELAY_MS);
    }

    printTable(rows);

    const timestamp = runAt.toISOString().replace(/[:.]/g, "-");
    const outputPath = `/tmp/parity_report_${timestamp}.json`;
    await fs.writeFile(outputPath, JSON.stringify({ run_at: runAt.toISOString(), env, lag_tolerance_days: lagToleranceDays, rows }, null, 2));
    console.log(`Structured parity report written to ${outputPath}`);

    await insertHealthRows(pooledSql, rows, runAt);
    console.log(`Inserted ${rows.length} pipeline_health rows.`);

    const bad = rows.filter((row) => row.verdict === "NAMING_MISMATCH" || row.verdict === "BRONZE_COUNT_UNRESOLVED" || row.verdict === "PROMOTION_STALLED");
    if (bad.length > 0) {
      console.error(`pipeline-parity-check found ${bad.length} alerting verdict(s): ${bad.map((row) => `${row.report_type}:${row.verdict}`).join(", ")}`);
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled([directSql.end(), pooledSql.end()]);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
