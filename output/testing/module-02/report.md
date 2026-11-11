# Module 02 — onboarding test and fix report

Date: 26 October 2026, Asia/Kolkata
Status: automated checks passed; database migrations applied; application source remains local.

## What was covered

Student single and CSV onboarding, teacher/trainer onboarding, mentor onboarding, institution-admin onboarding and assignment, dedicated super-admin onboarding, invitation verification/regeneration, email processing, and the Module 01 first-login handoff.

Permissions are checked both in server actions and in the database transaction. The database derives the inviter from the verified active identity and selected shared-dashboard role; it does not accept a browser-supplied inviter ID.

| Actor | Allowed onboarding |
|---|---|
| Super admin | Students, teachers/trainers, mentors and institution admins; super admins through the dedicated flow |
| Institution admin | Students in their own institution |
| Teacher/trainer, student, public, unauthenticated | Denied |

## Confirmed problems and changes

- Provisioning previously created the user, role and invitation through separate network writes. These now commit or fail together per row inside a bounded database transaction.
- CSV uploads previously performed an extra conflict query per row, followed by several more sequential queries and an email request per user. Provisioning now uses 100-user RPC batches: 10 calls for 1,000 users; 25 calls for 2,500 users. Role, campus and existing-account checks execute beside the data.
- Existing-account imports previously reassigned campus/roles. Onboarding now refuses active, linked, suspended, deleted, different-role or different-campus accounts. Explicit super-admin assignment of an existing institution admin is a separate validated transaction.
- Matching pending imports reuse the same invitation/token. A partial upload can be retried without creating another pending invitation for already completed rows. A failed or expired invitation can receive a fresh token; prior pending invitations are revoked.
- Emails no longer hold the upload request open. A durable invitation outbox records queued, processing, sent, failed and cancelled states.
- Only the backend worker can claim or acknowledge mail. Claims use SKIP LOCKED, a two-minute lease and a stable per-token provider idempotency key. Failed sends retry with exponential backoff, up to five attempts. Expired abandoned leases recover; the final abandoned attempt becomes failed.
- Token and lease comparisons prevent an old worker from acknowledging a replacement invitation. Acceptance, expiry or revocation cancels queued mail. A late acknowledgement cannot overwrite accepted status.
- Regeneration does not reset active accounts to invited, refuses accepted invitations, checks campus and student-role scope, and refuses rotation while a live send lease exists.
- Suspended/inactive institutions cannot provision new users, regenerate invitations or receive new admin assignments.
- Institution-admin onboarding now also creates the institution-admin mapping in the same transaction.
- CSV input is bounded to 750 KB and 2,500 users. Headers, names, email format/case, duplicate emails, supported roles, institution IDs and missing fields are checked before provisioning. Errors identify the failing CSV row.
- Invitation verification checks UUID token, matching email, account status/link/deletion, invitation status and strict expiry before exposing institution details. Viewing an expired link no longer performs a privileged database write.
- Email HTML escapes untrusted names, campus names, email addresses and links. Provider exceptions are not logged with private payloads.
- Invitation listing fetches stable cursor pages of 500, fetches institution names in one separate batched query per nonempty page and avoids Supabase's default row-limit truncation. Cursor pagination handles equal creation timestamps and avoids offset shifts from newer invitations.
- Removed the redundant anonymous email-to-account lookup from the verification page. Admin and institution pages allow up to 120 seconds for bounded imports, subject to hosting limits. Email work remains outside that request.
- Success notices distinguish a queued email from a reused invitation. Layouts were not redesigned.

## Verification

- Full application suite: **271 tests passed across 32 files**, including Module 01 regressions.
- Production build passed. Focused lint passed for the rewritten onboarding service, worker, email helper, link helper and their tests.
- Standalone repository TypeScript checking still has existing failures in unrelated areas; the scoped output contained no onboarding/email/institution-action errors.
- Actual SQL checks ran under authenticated and service roles, with synthetic fixtures and automatic rollback. They covered role/campus boundaries, dedicated super-admin gating, admin mappings/assignment, client queue tampering, normalized retry idempotency, input/account conflicts, regeneration, token invalidation, worker retries, lease recovery/exhaustion and accepted-status races.
- Module 01 SQL checks passed after the new triggers were installed.
- Real database capacity run: **2,500 synthetic students, role assignments and queued invitations in 25 sequential batches; 15,113.2 ms of database work**. Fixture and audit writes were rolled back; no emails were sent.
- This capacity run excludes browser, HTTP round trips, Brevo, inbox delivery and concurrent imports. It is not an end-to-end latency or maximum-capacity result.
- Final live counts were unchanged: 11 core users, 10 auth users, 15 role assignments and 3 invitations. No synthetic institutions remained.
- Worker readiness command passed without dispatch: `npm run onboarding:worker -- --check`.
- Anonymous HTTP calls to provisioning, regeneration and mail claiming returned 401 / permission denied. Scanning 41 public build artifacts found zero matches for the three configured private credential values checked; this is not a full repository-history secret audit.
- Security/performance advisors were reviewed. The authenticated SECURITY DEFINER notices for the three onboarding transactions are expected bounded APIs with active-actor, role and target checks. Mail claim/acknowledgement are service-role-only.

## Deployment and operations

Database project: Hynox Campus, `ivuxikqspzdjmgoxcnqu`, matching the application environment.

Applied migrations:
- `20261026102852_module_two_onboarding.sql`
- `20261026103247_module_two_outbox_guard.sql`
- `20261026103755_module_two_institution_status.sql`

The application code is not deployed. Deploy it with the migrations already present, then run the mail worker as a supervised persistent server process:

```text
npm run onboarding:worker -- --check
npm run onboarding:worker
```

The worker uses the existing server-side Supabase service key, Brevo key and application URL environment variables. Keep them out of the browser. A production worker needs automatic restart and a running-process/queue-age monitor. This test run did not start a dispatch loop or create recurring automations.

A successful upload means the account/invitation was provisioned. `queued` means awaiting a worker; `sent` means accepted by the email provider; `accepted` means account activation reached the login handoff. Inbox delivery/open/bounce tracking requires provider webhooks and was not added.

## Your manual checklist

Use isolated test accounts/data and a controlled sender. No staging currently exists, so mark unavailable provider/browser checks BLOCKED rather than using real students.

- [ ] Sign in as a super admin. Onboard one new student, teacher, trainer, mentor, institution admin and dedicated super admin. Confirm campus/global scope, role, invitation label and intended dashboard after login.
- [ ] Sign in as an institution admin. Onboard a student in your own institution; attempt another institution and privileged roles. Only the first operation should succeed.
- [ ] Confirm teacher/student/public accounts cannot call onboarding or regenerate invitations.
- [ ] Import valid 1,000- and 2,500-student CSV fixtures. Record full browser/request time, hosting timeout behavior and any UI lag. Verify exact counts in the controlled database.
- [ ] Submit missing fields, malformed emails, duplicate/case-variant emails, an invalid institution ID, conflicting role/campus, an empty CSV, duplicate headers, 2,501 rows and an oversized file. Confirm useful errors and no writes from invalid file validation.
- [ ] Re-import the same pending CSV, then retry after an interrupted request. Verify existing invitation IDs/tokens are reused and completed rows are not duplicated.
- [ ] Run the worker with a controlled sender. Verify queued → processing → sent; confirm a real test inbox receives the expected escaped template and activation link.
- [ ] Simulate a provider outage/rate limit in staging. Confirm backoff, eventual failed status and successful regeneration/retry after recovery.
- [ ] Stop/restart a staging worker during processing. Verify lease recovery; run two workers and verify they claim different pending jobs.
- [ ] Regenerate an unused invitation. The previous token must fail. Test missing, malformed, expired, revoked, wrong-email and already-accepted links.
- [ ] Open the link using the invited Google identity. Confirm one active linked user, correct roles and accepted invitation. Refresh/repeat login and confirm no duplicate activation or invitation.
- [ ] Try activation with another Google identity. It must not acquire the invited account's role.
- [ ] Check suspended/deleted users and suspended/inactive institutions. They must not be reactivated or provisioned through these flows.
- [ ] Confirm invitation lists show more than 1,000 entries and accepted/expired/failed states update after refresh.
- [ ] Record failures with role, URL, expected/actual result and redacted evidence.

## Remaining limits and risks

- Real OAuth/browser flows, real provider/inbox delivery, multiple simultaneous imports and production deployment remain unverified because no staging/test accounts were provided.
- One pre-existing case-insensitive duplicate-email group remains for administrator review. The code rejects ambiguous matches and prevents new duplicate identities; no accounts were merged/deleted.
- Brevo idempotency has a limited retention window. A crash after provider acceptance but before acknowledgement can still produce uncertain delivery or duplicates outside that window. This is not an exactly-once delivery guarantee. See [Brevo idempotency documentation](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).
- Uploads are atomic per row, committed per batch, not all-or-nothing across the entire CSV. Earlier batches remain provisioned if a later request fails; retry is designed around that.
- Existing whole-project advisor findings remain outside this module: RLS-disabled delivery/academic tables, anonymous privileged functions in other modules and disabled leaked-password protection. See [Supabase database lint guidance](https://supabase.com/docs/guides/database/database-linter).
- No dashboard-wide performance claim, unlimited-concurrency claim or whole-application security certification is made.

Evidence: `automated-results.json`, `capacity-results.json`, `security-advisors.json`, `performance-advisors.json`, plus repeatable SQL suites under `supabase/tests/`.


## Follow-up: local admin dashboard regression

The real browser login exposed PGRST200 in the invitation loader: PostgREST could not resolve the embedded cross-schema institution relationship. Earlier mocks did not exercise that REST contract. Replaced the embed with a separate institution-schema query for the unique tenant IDs in each page, and skipped that query entirely for an empty invitation list. Added four regression cases. All 269 application tests, focused lint and the production build passed. The exact invitation selector and institution batch lookup also passed a read-only live REST check through scripts/check-onboarding-query.mjs; evidence is in rest-schema-check.json. That contract check uses a server client and does not certify browser session/RLS behavior. No account, permission or schema changes were made for this fix.

## Follow-up: invitation delivery and local startup

The two manually created invitations remained queued with zero attempts because only the Next.js web process was running. No mail worker was running. Processed each invitation once using the bounded worker, recorded its Brevo message ID, and verified matching delivered events through Brevo's transactional-events API: student invitation to akshaykumar07.m@gmail.com and institution-admin invitation to akshaykumar7.m@gmail.com. Final queue check: zero queued/processing messages and two provider-accepted invitations. No invitation tokens were regenerated.

The worker is now running locally. npm run dev now starts both Next.js and the email worker through scripts/dev.mjs, passing compiler options as a single serialized argument without shell quoting. Production still requires its supervised persistent worker. Added safe provider status/code diagnostics without logging provider payloads/keys, and a --once option for bounded processing. All 271 tests, focused lint, worker execution, launcher argument/exit smoke check and the production build passed. The saved Next development log did not contain the reported stringify error, so that exact message was not reproduced. Provider delivery events confirm delivery to the receiving mail server, not which inbox folder Gmail selected.
