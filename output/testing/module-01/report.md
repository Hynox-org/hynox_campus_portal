# Module 01 login and session test report

Date: 26 October 2026 (Asia/Kolkata)
Status: APPLICATION AUTOMATED PASS; LIVE MODULE 01 DATABASE HARDENING APPLIED; manual and staging integration checks pending. Not a production security certification.

## Scope and module boundary

This pass covers existing-account Google/password sign-in, callback redirects, authenticated identity resolution, active status, role dashboard routing, sign-out, session-refresh cookies and login-boundary cache clearing. Bulk CSV onboarding, account creation, invitation issuance, academic workflows and their database policies are separate modules. The first-login invitation handoff is included because authentication reaches it. It now uses a bounded database transaction; bulk onboarding remains a separate module.

The user initially limited testing to local/mocked checks, then explicitly authorized checking and improving the connected Supabase database. Verified project: Hynox Campus (`ivuxikqspzdjmgoxcnqu`), matching the application environment hostname. Two recorded migrations were applied with synthetic SQL checks. Fixture users, institutions, invitations and audit records were rolled back. Counts remained 11 core users, 10 auth users, 15 role assignments and 3 invitations. No real emails or production load tests were run.

## Results

- Before changes: 25 test files / 169 tests passed.
- New regression cases reproduced ordinary inactive-account access, unsafe identity relinking, unsafe callback destinations and cookie-batch loss before the corresponding fixes.
- Final: 30 test files / 233 tests passed, no failures (64 more cases than baseline). Callback mocks were simplified around the new atomic RPC; database assertions cover the transition itself.
- Optimized production build passed, including its application TypeScript phase.
- Separate whole-repository `npx tsc --noEmit` still fails on pre-existing scratch, career, newsletter, onboarding and unrelated navigation test issues. The authentication test/type failures in touched callback and shared-login tests were corrected; no auth-scope type errors remain.
- Focused ESLint passed for new tests/helpers, callback, auth actions, login page, shared-login action, cache reset, session middleware and proxy. `src/services/auth.ts` retains three pre-existing `any` interface fields; a broader contract/type migration was not attempted.
- Whole-repository baseline lint was already failing (789 errors / 1,780 warnings). Unrelated code was not reformatted or bulk-fixed.

## Local fixes and evidence

1. Inactive/invited/suspended ordinary accounts now fail the central server identity check and protected-route proxy. Role-query errors fail closed. An unavailable role lookup no longer loops on the login page.
2. Reading the session no longer performs email-based relinking, status activation, invitation updates or claims writes. This removes write side effects and fallback work from normal page/action authorization. First-time linking remains an explicit OAuth callback operation.
3. Callback calls `core.complete_login()` without accepting a user ID or role from the browser. This bounded privileged transaction checks the actual auth identity and confirmed email, locks the matching account and valid invitations, rejects deleted/inactive/suspended/mismatched accounts, links eligible invitations, accepts unexpired invites and refreshes claims atomically. Safe confirmed OAuth onboarding is also retained in the signup trigger for deployed-client compatibility. Signup metadata cannot select an institution. Repeated login is idempotent.
4. Callback redirects use configured application origin (or request origin), never forwarded-host/protocol input. Application `next` paths reject external/protocol-relative, backslash, encoded-leading-separator and control-character destinations.
5. Password actions reject file-valued, missing, malformed and oversized credentials; trim email but preserve password whitespace. OAuth/password errors shown by these actions avoid internal provider details.
6. Login UI prevents duplicate OAuth initialization, announces status/errors and explains account-unavailable/mismatch failures. Its Google icon is no longer recreated as a component inside each render.
7. Sign-out checks provider failure before reporting success/redirecting. Successful sign-out clears shared role selection. Both dashboard cache providers are cleared when entering either login route. Saved resume draft storage was not deleted.
8. Session refresh preserves cookies across multiple SDK write batches; a failed user verification is treated as anonymous. Proxy/callback responses prohibit shared caching with `private, no-store`.
9. Admin can reach the Teacher workspace, matching the Teacher page's existing explicit authorization. The ordinary Student/Teacher/Trainer/Institution Admin/Public/Mentor role boundaries and configured shared-role restrictions are covered by regression tests.
10. The proxy no longer performs business-role lookups before the callback performs its own validation. No cross-request authorization cache was introduced.

## Local HTTP and performance smoke

Production-mode local server: http://localhost:3101

- `/login` and `/super-admin-login`: HTTP 200.
- `/admin`, `/institution`, `/teacher`, `/student`, `/academic`, `/public`: anonymous HTTP 307 to login.
- `/auth/callback` without a code: safe generic login-error redirect.
- All inspected responses: `private, no-store`.
- Warm burst of 10 concurrent anonymous GET requests to `/login`: p50 21 ms, p95 22 ms on this machine in this run.

Those numbers do NOT measure authenticated dashboards, Google OAuth, Supabase query throughput, sustained concurrency or maximum capacity. No authenticated before/after performance claim is made. Overall dashboard profiling remains on the performance checklist.

## Credential boundary checks

- Scanned 41 public `.next/static` JS/JSON/map artifacts for the configured Brevo, sandbox-engine and Supabase service-role key values: zero matches. Values were read only in memory and were not written to evidence.
- No tracked `.env`, PEM, P12 or key files found by the filename check.
- No loaded private credential variable with a `NEXT_PUBLIC_` prefix found.
- These checks do not certify repository history, logs, all secret formats, third-party dependencies or deployed assets. No production keys were rotated.

## Security and integration items still open

AUTH-DB-01 - FIXED / SQL REGRESSIONS PASS: active status is required by the shared database identity helper; client changes to sensitive identity/status/campus fields are blocked; campus-admin role grants and invitations check the target campus and permit only student onboarding. Role and auth lookup catalogs have RLS and read-only client grants. Anonymous users cannot list account or invitation tables. The tenant helper has a fixed search path.

AUTH-DB-02 - FIXED AT DATABASE AND CALLBACK CONTRACT / BROWSER INTEGRATION PENDING: validated account linking, invitation acceptance and claims refresh now run in one transaction. Synthetic SQL checks covered allowed profile changes and invitations, forbidden cross-campus grants/invites, privilege escalation, confirmed/unconfirmed/expired/suspended identities, atomic first login and repeated login. Real provider/browser checks still require test accounts.

AUTH-DB-03 - OPEN OUTSIDE MODULE 01: the advisor reports existing RLS-disabled delivery/academic tables, anonymous privileged functions in other modules, and disabled leaked-password protection. These remain release risks; Module 01 passing does not certify the full database. Consult https://supabase.com/docs/guides/database/database-linter and the saved advisory reports. The authenticated SECURITY DEFINER warning for `complete_login` is expected: that function deliberately performs a self-scoped, validated transition that ordinary row policies cannot allow. Its API has no arbitrary target or role parameters.

AUTH-E2E-01 - MANUAL PENDING: Google consent/cancellation, actual expired sessions, sign-out in a second browser tab, browser Back after sign-out, and provider/network failures need real browser test accounts. A second already-open tab is not proven to erase its rendered private data immediately; its next protected request must be denied.

AUTH-OPS-01 - NOT MEASURED: provider brute-force/rate-limit configuration, production redirects/cookie settings, authenticated load, browser memory and real cross-account navigation have not been verified. No unlimited-capacity or unhackability claim is appropriate.

## Manual checklist for the user

Use local test accounts. Do not disable a real student, change live roles or manufacture expired sessions in production to complete this list. Mark unavailable cases BLOCKED.

- [ ] Open http://localhost:3101/login in a private browser window. Confirm one clear sign-in button, keyboard focus, readable errors and a usable 375px/mobile layout.
- [ ] Before signing in, open `/admin`, `/institution`, `/teacher`, `/student` and `/academic` directly. Each must send you to login without private dashboard data.
- [ ] Sign in using an existing active test account. Google OAuth may return to the configured application origin (currently distinct from port 3101); use the correctly registered local URL for authenticated checks. Do not change production redirect settings for this test.
- [ ] For each available test role, confirm the expected destination: Admin `/admin`; Institution Admin `/institution`; Teacher/Trainer `/teacher`; Student `/student`; Public/Mentor `/public`.
- [ ] While signed in as Student, type `/admin` and `/institution` directly. You must not enter those workspaces or see their data. Admin may also open `/teacher` as intended.
- [ ] Refresh a permitted dashboard and open a deep link. Confirm the role remains correct and no redirect loop occurs.
- [ ] Open two browser tabs with the same test session. Sign out in one; refresh or attempt a protected action in the second. It must not successfully read/write protected data. Also record whether old rendered content remains visible until refresh.
- [ ] Press Back after sign-out. Attempt a fresh protected action or reload; access must be denied. Record any cached private content that remains visible.
- [ ] Sign in as another test account and verify the previous account's roster/progress/resume data is not displayed. Confirm role switching uses the configured shared account only.
- [ ] If inactive/suspended test accounts already exist, verify they cannot enter protected dashboards. Do not change production accounts just for this check.
- [ ] Cancel Google sign-in, retry, and test temporary network loss. Confirm safe messages, no duplicate initialization and a working retry.
- [ ] Record each result with role, URL, expected/actual behavior and screenshot (redact personal information). Send the failures and blocked cases back before module sign-off.

## Evidence files

- automated-results.json: all Vitest assertions, file outcomes and timings.
- local-smoke-results.json: local HTTP statuses, cache headers, anonymous burst and public-build secret scan counts.
- credential-boundaries.json: tracked-file/public-variable boundary check.

Database migrations are live; application source changes are local and are not deployed. The local production server on port 3101 is left running for review. Module 02 account creation/onboarding has not started.

## Database evidence

- `supabase/migrations/20261026092356_module_one_auth_hardening.sql`
- `supabase/migrations/20261026092702_module_one_auth_catalog_permissions.sql`
- `supabase/tests/module_one_auth.sql`: repeatable assertions with automatic fixture rollback. Run through a privileged SQL connection; assertion failures abort the operation.
- `database-before.json`: pre-change definitions and policies for recovery review (not user data or secrets).
- `security-advisors.json` / `performance-advisors.json`: advisor output; unrelated findings remain open.

Do not blindly reverse security migrations: restoring the old policies would restore the documented vulnerabilities. Review the saved definitions first.

