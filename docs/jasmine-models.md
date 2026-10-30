# Jasmine model selection

New conversations discover the newest **compatible active Sonnet**, using Anthropic's Models API (`2026-10-21`): `line`, `lifecycle`, release `created_at`, `max_tokens`, medium effort and adaptive-thinking capabilities. IDs are opaque; model-name sorting and invented `latest` aliases are deliberately avoided. Discovery paginates, shares one in-flight request per server instance, caches successes for five minutes and failures for 30 seconds. Serverless instances maintain independent caches.

The explicit, tested fallback is `claude-sonnet-5-5`. Missing metadata or discovery failure uses this fallback. A newly discovered model that rejects an initial request with HTTP 400/404 can fall back once, before tools run and only without a pinned/signed history. Authentication, rate limits, outages, refusals, truncation and post-tool errors are never retried on another model. If the fallback is unavailable, the request fails before tools. No strategy can promise compatibility with unknown future breaking changes: unavailable capabilities are skipped, actual responses are validated before execution, and unsupported behavior fails closed.

Requests use adaptive thinking, medium effort, automatic tool choice and an 8192-token output ceiling (thinking and text combined). All 24 tools remain available. Local validation checks every call against the existing flat argument schemas before **any** tool in the response executes. Unknown blocks, stop reasons, tools, duplicate call IDs and invalid arguments are rejected. Truncated or refused responses cannot execute partial commands. Tool schemas that gain nested/complex types must update this validator or adopt a full JSON Schema validator.

Each conversation returns `history_model`; the chat sends it back with `history`. Existing conversations stay on their validated model, while a new conversation picks up refreshed discovery. Signed thinking/redacted blocks, tool calls, tool results and final assistant content stay unchanged. The separately composed `answer` remains the UI/CSV narrative. Current-date instructions append to each new user turn so midnight does not rewrite the signed system prefix. A retired/incompatible pinned model requires a new conversation; client-side histories without a model may migrate only when they contain no signed blocks.

SDK and tool retries are disabled. Within one request, repeated `create_action` arguments reuse the first result, including uncertain network failures. Post-tool model failures and tool-limit exhaustion return preserved history and a visible partial outcome, including completed or uncertain task requests. This is not cross-request idempotency: a user deliberately resubmitting an entire task request can still create a new task. Backend idempotency would be a separate API change.

Run isolated tests with `node --test tests/*.test.cjs`; focused model/route coverage is in `jasmine-sonnet.test.cjs` and `jasmine-query.test.cjs`. Fixtures mock Anthropic, authentication and the executor. Never use live credentials or production actions for these tests. Repository checks are `npm run type-check`, `npm run lint` and `npm run build`. The pipeline parity workflow accesses production systems and is not a safe aggregate test for this change.

Official references (verified October 30, 2026):

- [Models list and metadata](https://platform.claude.com/docs/en/api/models/list)
- [Sonnet 5.5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide)
- [API version history](https://platform.claude.com/docs/en/api/versioning)
