# Pipeline Parity Check Patch Summary

This patch applies the requested **FIX 1** and **FIX 2** changes to the `pipeline-parity-check` TypeScript job.

## Implemented changes

| Fix | Implementation |
|---|---|
| **FIX 1: registry-driven mismatch detection** | Removed the duplicated hardcoded supported report set from the parity job. The job now reads the transform-worker `src/strategies/registry.ts` source at runtime, parses the `TRANSFORM_STRATEGIES` keys, and fails loudly if the registry cannot be loaded or parsed. `aged_receivables_detail → aged_receivables` remains only a Gold lookup alias; it no longer masks the raw fetch type mismatch. |
| **FIX 2: unresolved Bronze count handling** | Added `BRONZE_COUNT_UNRESOLVED` as an explicit verdict when AppFolio source count succeeds but the latest Bronze payload row count cannot be derived. Bronze row counting now handles top-level arrays, `results`, `rows`, `data`, `items`, and any single top-level array key. The job logs the detected Bronze count source key, including `unknown`, in run notes and the JSON report. |

## Validation performed

The patched source was validated from `/home/ubuntu/pipeline-parity-check` with the following commands.

```bash
npm run typecheck
npm run build
```

Both commands completed successfully. The job was not executed against production AppFolio or Neon because production credentials are intentionally externalized through environment variables.

## Files changed

| File | Change |
|---|---|
| `src/index.ts` | Runtime registry parsing, alias-safe mismatch logic, `BRONZE_COUNT_UNRESOLVED`, expanded Bronze count shape detection, run-output notes for Bronze count key, and non-zero exit handling for unresolved Bronze counts. |
| `README.md` | Updated scope, run guidance, verdict table, interpretation guide, and validation notes for the patched behavior. |

