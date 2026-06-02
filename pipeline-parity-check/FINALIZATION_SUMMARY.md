# Pipeline Parity Check Finalization Summary

This finalization keeps the existing parity-check diagnosis logic intact and adds the requested daily GitHub Actions schedule. It preserves explicit production environment gating, the no-`CHECK`-constraint rule for `pipeline_health.verdict`, the direct-versus-pooled database split, and the existing table/JSON output formats.

## Verification result

| Requirement | Result |
|---|---|
| **FIX 1 present** | Confirmed. `src/index.ts` loads registered strategy keys from the real transform-worker `TRANSFORM_STRATEGIES` source at runtime and derives `NAMING_MISMATCH` from the raw fetch report type not being an exact registered key. |
| **FIX 2 present** | Confirmed. `src/index.ts` emits `BRONZE_COUNT_UNRESOLVED` when AppFolio source counting succeeds but the latest Bronze `raw_data` shape cannot produce a row count. |
| **Alerting exit set** | Confirmed. The process exits non-zero when any row returns `NAMING_MISMATCH`, `PROMOTION_STALLED`, or `BRONZE_COUNT_UNRESOLVED`. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed. |

## Added workflow

The finalized deliverable includes `.github/workflows/pipeline-parity-check.yml`. The workflow runs once daily by default at `30 7 * * *`, supports manual `workflow_dispatch`, prevents overlapping runs with a concurrency group, installs dependencies with `npm ci`, builds with Node 22, runs `npm start`, uploads `/tmp/parity_report_*.json` artifacts with 30-day retention, and optionally posts a generic Slack failure alert only when `SLACK_PARITY_WEBHOOK` is configured.

The cron includes an explicit comment that the schedule **must be moved to 45 minutes after the real nightly AppFolio → Bronze refresh window** before the daily schedule is enabled.

## README Scheduling section added

The README now documents the daily workflow, the production-only secret wiring, the cron alignment requirement, and a pre-flight manual run. The pre-flight note instructs the operator to run the workflow once with `workflow_dispatch` and confirm that `aged_receivables_detail` resolves to **NAMING_MISMATCH** and `delinquency` resolves to **CLEAN** on production.

## GitHub secrets to set

Set the following names as repository-level GitHub Actions secrets under **Repository → Settings → Secrets and variables → Actions → New repository secret**. Do not hardcode these values in source, README, workflow YAML, or committed environment files.

| Secret name | Required | Notes |
|---|---:|---|
| `PARITY_DATABASE_URL` | Yes | Pooled connection string for the **PRODUCTION Gold database**. |
| `PARITY_DATABASE_DIRECT_URL` | Yes | Direct connection string for the **PRODUCTION Gold database**. |
| `APPFOLIO_CLIENT_ID` | Yes | AppFolio API client identifier. |
| `APPFOLIO_CLIENT_SECRET` | Yes | AppFolio API client secret. |
| `SLACK_PARITY_WEBHOOK` | No | Optional generic Slack failure notification webhook. |

## Deliverable archive

The updated clean archive is `/home/ubuntu/pipeline-parity-check-final.zip`. It includes source, migration SQL, package metadata, lockfile, README, patch summary, finalization summary, and the GitHub Actions workflow. It excludes dependency folders and build byproducts.
