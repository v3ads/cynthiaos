-- pipeline-parity-check guardrail table
-- Run with DATABASE_DIRECT_URL against the same Neon database/schema as the gold_* tables.
-- This DDL is intentionally idempotent and intentionally has no CHECK constraint on verdict.

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
);

CREATE INDEX IF NOT EXISTS idx_pipeline_health_report_type_run_at
  ON pipeline_health (report_type, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_health_verdict_run_at
  ON pipeline_health (verdict, run_at DESC);
