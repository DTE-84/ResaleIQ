# Backend security pass

## Deployed protections

- AI requests require a registered user verified by Supabase Auth. The gateway JWT check is also enabled.
- A server-only, security-invoker RPC atomically reserves quota before a paid AI call: 10 requests per UTC clock hour and 30 per UTC day, shared across text and image actions. Failed provider attempts count. These are conservative launch safeguards, not subscription entitlements.
- Quota is stored in a private RLS-enabled table with one row per user. Browser roles cannot read, edit, or invoke it. Account deletion cascades to quota records. No prompts or images are stored there.
- Quota or Auth outages fail closed. Provider errors are sanitized; responses are not cached; outbound requests have deadlines.
- Request bodies are bounded while streaming. Text has a 12,000-character limit and photos have a 5 MB limit with a JPEG/PNG/WebP allowlist. The model and token budget are server controlled.
- The unused `/api/generate` proxy returns 410 without calling the provider.
- Photo identification returns no price. Random valuations and marketplace attribution have been removed.
- Inventory browser access is limited to authenticated users, with existing ownership policies preserved for select, insert, update, and delete.
- Removed broad browser grants (including RLS-bypassing TRUNCATE) on both inventory and the hosted legacy listings table.

## Validation

`npm run test:security` exercises the handler with mocked HTTP dependencies and executes both migrations in embedded Postgres (PGlite). It checks unauthenticated calls, quota denial/outages, forged identity, rejected inputs, sanitized failures, and cross-account reads/writes/deletes, as well as browser denial of quota access and hourly/daily reset behavior.

PGlite uses equivalent test Auth roles and a test `auth.uid()` function; it does not run Supabase Auth itself. The separate, explicitly invoked `node tests/live-security.mjs` uses authenticated CLI credentials in memory, creates two disposable accounts, verifies real cross-account inventory isolation, ownership forgery/reassignment denial, browser quota RPC denial, successful AI calls and 429 quota enforcement, and deletes only those accounts. `node --env-file=.env tests/live-web-security.mjs` checks the public web deployment, project/public-key configuration, updated scanner and the retired legacy route.

## Deployment order and outstanding checks

1. Authenticate Supabase CLI to the intended ResaleIQ project. Verify the target project before writes.
2. Review existing table grants, policies, exposed schemas and migrations. Apply the new migration only after confirming the inventory migration is already applied (or applying both on a fresh database).
3. Configure the Edge Function's `ANTHROPIC_MODEL` to a supported model available on the project's Anthropic account. `ANTHROPIC_API_KEY` must remain server-side. The handler also requires the standard hosted `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values. Never put the service key in a VITE variable.
4. Deploy `visual-ingestion` with gateway JWT verification enabled, then deploy the web app and retired legacy route. Missing configuration or migration intentionally disables AI calls with a 503.
5. Run Supabase security advisors and smoke-test missing/invalid/expired user tokens, two real test accounts, image/text calls, and quota denials against the hosted function. Do not consider this release gate complete until those checks pass.
6. Add account recovery/deletion, billing entitlements, provider/project-wide spend controls, abuse monitoring, and runtime validation for listing/pricer JSON before release. Per-user quotas alone do not prevent abuse through many accounts.

Deployment on November 8, 2026: authenticated with `npx supabase` (3.1.0-beta.26); the Scoop executable (2.104.0) does not read the saved login here. Confirmed the linked project, local frontend and deployed frontend all target ResaleIQ (`tbizlbcifhgmxvlvdjat`). After restoration reached `ACTIVE_HEALTHY`, reviewed the live schema, grants, policies and existing inventory migration. Applied the security migration and its migration-history record in one transaction. Deployed `visual-ingestion` with `verify_jwt: true`, configured `ANTHROPIC_MODEL=claude-sonnet-4-6`, and replaced the failing hosted provider key with the locally verified working key without printing its value. Model availability and a direct API request were verified against Anthropic.

Deployed the web app to the existing Vercel project `resale-iq`, production alias `https://resale-iq-xi.vercel.app`, deployment `dpl_9SLa2HUDq4jYCjjiraZVtGXeGNje`. The public deployment smoke test confirms the correct Supabase project/public key, truthful scanner text and HTTP 410 from `/api/generate`. Vercel's protected secret values cannot be pulled; verified the actual public build instead. No environment-value updates were needed or applied on Vercel.

Verified hosted database permissions: anonymous inventory access denied, authenticated TRUNCATE denied on both tables, browser quota execution denied, service-role quota execution allowed, and quota RLS enabled. Gateway probes without credentials, with an invalid token and with a public API key returned 401. Two-account live tests passed for inventory isolation, ownership protections, authenticated AI text and image identification without fabricated valuation, and quota denial. Disposable accounts were removed; the original account count remained 1 and no test quota records remained.

The hosted security advisor reports one remaining warning: breached-password protection is disabled. Supabase documents this feature as Pro-plan-and-above; no paid upgrade has been made. Before release, complete recovery/deletion, entitlements, project-wide spend controls, remaining dependency fixes and broader app/device checks. This pass does not certify the entire product as store ready.

Deployment tooling note: CLI 3 rejects the repository's legacy `[inbucket]` local-development config. Used a minimal temporary config containing only the function's entrypoint and JWT setting, with no source changes to unrelated local configuration. Temporary credential files were deleted after use. For repeat deployments, migrate the repository config to CLI 3 explicitly or use the same minimal staging approach; never push the repository's local Auth defaults to production.

Dependency audit: compatible updates removed the reported high-severity findings. Five low/moderate findings remain in the PWA build dependency chain; these still need resolution before release.

References: [Supabase function authentication](https://supabase.com/docs/guides/functions/auth), [server-verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser).
