# pipeline-parity-check

`pipeline-parity-check` is a read-only CynthiaOS guardrail job for the AppFolio → Bronze → Silver → Gold medallion pipeline. It re-fetches each in-scope AppFolio source report only to count rows in memory, compares that source count to the latest Bronze and Silver payload counts plus mapped Gold table counts, prints a human-readable parity table, writes `/tmp/parity_report_<timestamp>.json`, and inserts one `pipeline_health` row per report type per run.

The implementation intentionally does **not** trigger ingestion, transformation, promotion, deletes, or updates against Bronze, Silver, or Gold business tables. The only database writes are the idempotent `pipeline_health` DDL and per-run health inserts.

## Delivered files

| File | Purpose |
|---|---|
| `src/index.ts` | Single TypeScript entrypoint for AppFolio source counting, Bronze/Silver/Gold parity reads, verdict derivation, stdout output, JSON report writing, and `pipeline_health` inserts. |
| `migration.sql` | Idempotent `pipeline_health` DDL with indexes on `(report_type, run_at DESC)` and `(verdict, run_at DESC)` and **no** verdict `CHECK` constraint. |
| `package.json` | Runnable Node package with `typecheck`, `build`, `start`, and `dev` scripts. |
| `tsconfig.json` | Strict TypeScript configuration targeting Node 22. |

## Scope and naming reconciliation

The job mirrors the current `fetchReports.js` catalogue and checks only supported **non-maintenance** report types. It excludes `work_order` because that is maintenance. The supported set is loaded from the real transform-worker `TRANSFORM_STRATEGIES` registry source at runtime instead of being duplicated in this job; if that source file cannot be loaded or parsed, the job fails loudly rather than falling back to a stale list. The known catalogue/Gold lookup alias `aged_receivables_detail → aged_receivables` is used only to evaluate mapped Gold counts against `gold_aged_receivables`; **NAMING_MISMATCH** is still derived from the raw fetch type not being an exact registered strategy key.

`tenant_directory` is evaluated early, immediately after the aged-receivables mismatch check. Because `gold_tenants` does not carry a report-date column, the job uses `updated_at::date` as Gold freshness for that report.

## `pipeline_health` schema

| Column | Type | Notes |
|---|---:|---|
| `id` | `uuid` | Primary key, default `gen_random_uuid()`. |
| `report_type` | `text` | AppFolio/fetch catalogue report type, for example `aged_receivables_detail`. |
| `run_at` | `timestamptz` | Shared timestamp for all rows in a job run. |
| `appfolio_source_count` | `integer` | Count re-fetched from AppFolio in memory. |
| `bronze_count` | `integer` | Row count from latest Bronze payload. |
| `silver_count` | `integer` | Row count from latest Silver normalized payload. |
| `gold_count` | `integer` | Count from mapped Gold table or max count across mapped Gold tables. |
| `bronze_latest_date` | `date` | Latest Bronze `report_date`. |
| `gold_latest_date` | `date` | Latest mapped Gold `report_date` or timestamp-derived date. |
| `lag_days` | `integer` | `bronze_latest_date - gold_latest_date` in whole days. |
| `verdict` | `text` | Free text enforced by code, not by a database `CHECK`. |
| `env` | `text` | Explicit `CYNTHIAOS_ENV` gate value. |

## Exact run commands

The following commands are PowerShell-safe because they avoid inline shell-specific environment assignment. Run them from the checked-out `pipeline-parity-check` directory after setting environment variables in your host, Railway job, CI secret store, or shell profile.

```powershell
cd /home/ubuntu/pipeline-parity-check
npm install
npm run typecheck
npm run build
node dist/index.js
```

For a local PowerShell session, set environment variables like this before running the commands above:

```powershell
$env:CYNTHIAOS_ENV = "production"
$env:DATABASE_URL = "<pooled Neon Gold database URL>"
$env:DATABASE_DIRECT_URL = "<direct Neon Gold database URL>"
$env:APPFOLIO_CLIENT_ID = "<AppFolio client id>"
$env:APPFOLIO_CLIENT_SECRET = "<AppFolio client secret>"
$env:LAG_DAYS_TOLERANCE = "2"
cd /home/ubuntu/pipeline-parity-check
npm install
npm run build
node dist/index.js
```

For Linux, macOS, Railway, or cron, set the same variables through the scheduler environment rather than embedding credentials in the command. A cron wrapper can alert on the process exit code because the job exits non-zero when any report returns **NAMING_MISMATCH**, **BRONZE_COUNT_UNRESOLVED**, or **PROMOTION_STALLED**. If the transform-worker repository is not adjacent to the parity-check directory, set `TRANSFORM_REGISTRY_PATH` to the absolute path of `src/strategies/registry.ts`.

## Verdict logic

The verdicts are evaluated in this order. **NAMING_MISMATCH** wins first, then **BRONZE_COUNT_UNRESOLVED**, then **SOURCE_NARROW**, then **PROMOTION_STALLED**, then **CLEAN**. Every row also logs the Bronze count source key in the notes emitted after the table and in the JSON report, so payload-shape issues can be diagnosed from the run output.

| Verdict | Trigger |
|---|---|
| `NAMING_MISMATCH` | The AppFolio/fetch report type does not exactly match a key in the loaded transform registry. The `aged_receivables_detail → aged_receivables` alias is used only for Gold lookup and does not mask this mismatch. |
| `BRONZE_COUNT_UNRESOLVED` | AppFolio source count was fetched successfully, but the latest Bronze `raw_data` shape did not expose a countable array. The job records the detected Bronze count key as `unknown` so this does not silently pass as not narrow. |
| `SOURCE_NARROW` | AppFolio source count materially exceeds the latest Bronze payload count. Materiality defaults to `max(1 row, 1% of source_count)` and can be tuned with `SOURCE_MATERIALITY_ABS` and `SOURCE_MATERIALITY_PCT`. |
| `PROMOTION_STALLED` | Bronze count exceeds mapped Gold count, or Gold freshness lags Bronze freshness by more than `LAG_DAYS_TOLERANCE` days. |
| `CLEAN` | Counts and date freshness are within tolerance. Delinquency is expected to be the known-good control. |

## Five-line interpretation guide

1. **NAMING_MISMATCH** means the likely owner is transform-worker registry/routing; reconcile the fetch report type with `registry.ts` before debugging row logic.
2. **BRONZE_COUNT_UNRESOLVED** means the likely owner is Bronze payload-shape handling; inspect the note that reports the count source key and add explicit parsing for the observed shape.
3. **SOURCE_NARROW** means the likely owner is `fetchReports.js`; inspect date windows, caps, filters, and AppFolio report parameters before touching Gold promotion.
4. **PROMOTION_STALLED** means the likely owner is transform-worker routing/promotion; Bronze has data that is not advancing to the mapped Gold table or Gold freshness date.
5. **CLEAN** means the report is inside the configured parity tolerance; if many unrelated reports share the same stale Gold date, investigate the shared deploy, cron, registry, or promotion trigger path before applying per-report fixes.

## Scheduling

The project now includes `.github/workflows/pipeline-parity-check.yml` for a daily scheduled GitHub Actions run plus manual `workflow_dispatch` runs. The default cron is `30 7 * * *`, which corresponds to 07:30 UTC / 03:30 ET. This is only a safe placeholder; before enabling the daily schedule, move the cron so it runs **45 minutes after the real nightly AppFolio → Bronze refresh window**. The default `LAG_DAYS_TOLERANCE` is **2 days**, which absorbs normal refresh-timing skew while still catching real promotion stalls, and it can be tightened to **1 day** once the cron is aligned to 45 minutes after the confirmed Bronze refresh window.

| Secret name | Required | Purpose |
|---|---:|---|
| `PARITY_DATABASE_URL` | Yes | Pooled connection string for the **PRODUCTION Gold database** used for parity reads and `pipeline_health` inserts. |
| `PARITY_DATABASE_DIRECT_URL` | Yes | Direct connection string for the **PRODUCTION Gold database** used for idempotent `pipeline_health` DDL. |
| `APPFOLIO_CLIENT_ID` | Yes | AppFolio API client identifier used only to re-fetch source reports for in-memory row counting. |
| `APPFOLIO_CLIENT_SECRET` | Yes | AppFolio API client secret used only to re-fetch source reports for in-memory row counting. |
| `SLACK_PARITY_WEBHOOK` | No | Optional webhook for a generic failure notification. If unset, the workflow relies on GitHub's default failed scheduled workflow email. |

Set these names as repository-level GitHub Actions secrets under **Repository → Settings → Secrets and variables → Actions → New repository secret**. Do not put credential values in the workflow file, README, source code, or committed environment files.

Before enabling the daily schedule, run the workflow once through `workflow_dispatch` against production and confirm that `aged_receivables_detail` resolves to **NAMING_MISMATCH** and `delinquency` resolves to **CLEAN**. This pre-flight run validates the live verdict logic and confirms that the alerting set, artifact upload, AppFolio credentials, and production database secrets are wired correctly.

The scheduled workflow remains read-only against AppFolio, Bronze, Silver, and Gold business tables. The only database writes are the idempotent `pipeline_health` DDL and per-run `pipeline_health` inserts.

## Validation performed

The patched job has been dependency-installed, type-checked with `tsc --noEmit`, and built with `tsc`. It was not executed against production AppFolio or Neon in this sandbox because the required production environment variables are intentionally not embedded in the deliverable.
