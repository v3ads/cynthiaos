# Verified owner statistics

Companion backend: `v3ads/cynthiaos-api`, branch `fix/jasmine-owner-analytics`. No production release is authorized for these fixes yet.

Jasmine's owner-statistic display now comes from structured backend facts. Model prose and model-generated CSV tables cannot replace renewal-window counts, action-queue counts or income figures. The original assistant/thinking blocks remain unchanged in model history. Other requested tool results remain available, and partial failures retain verified facts without replaying tools.

- Management metrics include canonical `renewal_summary` with cumulative 30/60/90-day counts and explicit inclusive boundaries. The display validates boundaries and monotonic counts. Unknown report dates stay unknown.
- Today displays complete open-action counts separately from a capped displayed sample. It checks the displayed type counts against actual returned rows and never substitutes lease KPI totals for action counts.
- Income requires live provenance and shares Financials' source. Null is unknown, not zero. NOI/margin remain unavailable as full property performance because expenses are external.
- Owner recommendations are conservative follow-up prompts from the verified summary, rather than unsupported numerical prose. Detailed requested tool data is preserved separately. This intentionally prioritizes reliable owner numbers over free-form generated summaries.
- Older or malformed summary contracts fail closed with an explicit unavailable message. Existing unrelated chat/list behavior stays on its established renderer. All 24 tools remain available.

## Regression verification

`node --test tests/*.test.cjs` uses mocked Anthropic/auth/tools and isolated fixtures. Coverage includes the observed 0/1/14 renewal case; incorrect 14-within-60 model prose; queue 7+14+11 versus a 14-closeout lease metric; truncation and type-count validation; source freshness; live income/null values; contradictory model CSV; exact history; partial model failure; and preservation of other requested data.

Run `npm run type-check`, the production build, focused lint and the full suite. Full lint has existing baseline failures (43 errors/38 warnings before this branch); the modified CommonJS route fixture now declares its required Node import convention, removing five existing lint errors. No additional lint diagnostics are expected.

Deploy the companion API first in an isolated environment, then verify this frontend against it before any separately authorized production release. Local fixture tests and read-only production comparisons are not a substitute for deployed branch-to-branch runtime verification.

Validation on October 30, 2026: the full frontend test suite passed 43/43, typecheck and the local production build passed, and changed files have no lint diagnostics. Full lint remains nonzero at 38 errors/38 warnings, versus the documented 43 errors/38 warnings baseline (five existing Node-test import errors removed). The API suite passed 17/17; the paired-checkout contract check passed actual backend loader outputs through the actual Jasmine route and display using mocked model/auth and no network. Fresh read-only CynthiaCore values matched the sanitized regression fixtures. No branch code was deployed to production.
