# Jasmine Sonnet migration validation

Baseline: production commit `bff593f9f96df946df689d20d2bef4a9e8dcd2de`.

- Clean `pnpm 10.20.0 install --frozen-lockfile --ignore-scripts`: passed, resolution skipped. Lockfile change is limited to Anthropic SDK 1.3.0 and its new dependencies; unrelated package versions are preserved.
- `node --test tests/*.test.cjs`: **34 passed, 0 failed**. Anthropic, authentication and all backend tools are mocked; no live tasks or user records were accessed.
- `npm run type-check`: passed.
- Focused ESLint using the pnpm launcher on the model resolver, query route, chat component and new test files: passed.
- `npm run lint`: **43 errors, 38 warnings**. Running the same ESLint configuration on a clean archive of the baseline produces the same counts. Existing errors include CommonJS test imports; this change introduces no additional diagnostics.
- `npm run build`: passed with placeholder build-only Anthropic/Supabase values. Next.js compiled, checked types and generated pages. The build printed a local pnpm ESLint plugin-resolution diagnostic; standalone lint via the pnpm launcher was checked separately above.
- `git diff --check`: passed.

The production pipeline-parity workflow was not run: it is a live ingestion/database integration check, unrelated to model selection and unsuitable for isolated Jasmine command testing.

Coverage includes release-metadata selection, pagination, capability/lifecycle filtering, positive/negative caching, concurrent discovery/requests, unknown and incompatible models, explicit fallback, API errors, model pinning, signed thinking/redacted blocks, stable prefixes/date context, multi-round tool calls, complete-response validation, truncation/refusal, tool errors, duplicate action arguments/IDs, uncertain mutation outcomes and the round limit.
