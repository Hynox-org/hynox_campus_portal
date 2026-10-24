# Course newsletters

This module discovers active courses from enrollment records. Students explicitly subscribe in the dashboard's Daily Field Updates tab at `/student?parentTab=newsletters&tab=newsletters`. The legacy `/student/newsletters` URL redirects to that tab. Super admins manage delivery and course topic overrides in the final dashboard tab at `/admin?parentTab=newsletters&tab=newsletters` (the legacy `/admin/newsletters` URL redirects there). Shared demonstration accounts are excluded. Course creation and enrollment services do not depend on this feature.

## Operation

- Supabase Cron calls the `course-newsletter` Edge Function every five minutes. It runs independently of the laptop and Next.js deployment.
- Sending starts at 08:00 Asia/Kolkata by default and continues for up to twelve hours. A database lease prevents overlapping workers.
- Enrollment, institution, program, course status and consent are checked when reserving recipients and immediately before sending. Course/cohort dates are respected. Changing a course title changes the next edition's automatic topic. Ambiguous course names need an admin topic override.
- GDELT is the first source; Google News RSS search is the fallback. Neither needs a paid account or API key. Google News RSS is a best-effort public feed, not a guaranteed service; source failures appear in the admin panel and retry up to three times. No article bodies are scraped or republished. Only attributed headlines, publication timestamps and source URLs are stored. GDELT timestamps reflect when GDELT saw the story.
- Editions contain at most four fresh headlines per course. Recent URLs and normalized titles are deduplicated. If all topics are empty, no email is sent. Students enrolled in multiple courses get one combined edition.
- Brevo marketing campaigns handle unsubscribe links and recipient suppression. Signed webhook requests sync unsubscribes, hard bounces and complaints. Existing Brevo blocklists are never cleared by the worker.
- Default cap: 250 newsletter recipients per IST day, with 50 remaining Brevo credits reserved for other emails. The provider's available email credits are checked before sending. This reserve is best-effort because other applications may consume credits concurrently. Brevo remains the final quota authority. Above capacity, prioritize people who have waited longest; students may miss days until the plan is upgraded.
- A unique student/day reservation prevents duplicate daily newsletters. Every batch has a saved Brevo campaign ID before dispatch. If the send result is ambiguous, the worker reconciles the same campaign and never blindly resends. Review `unknown` campaigns in Brevo; a draft may be sent manually after confirming it was not previously accepted. `sent` means accepted by Brevo, not confirmed inbox delivery.
- Old recipient lists are deleted after seven days; local terminal batches and editions are retained for ninety days. Contacts are not deleted because other platform emails may use them.

## Deploy / rotate credentials

1. Apply the newsletter migrations in order to the selected Supabase project, including membership, fairness and scheduler follow-up migrations.
2. Deploy `supabase/functions/course-newsletter` with JWT verification disabled: the handler verifies its own random `x-newsletter-token`. Its import map pins the XML parser. Deploy the shared source files under `src/features/newsletter/content.ts` and `engine.ts` with the function.
3. Run `node --env-file=.env.local scripts/newsletter-setup.mjs`. It stores the existing Brevo credentials and a random scheduler token in encrypted Supabase Vault, restricted to service-role RPCs. It also configures the marketing unsubscribe/bounce webhook. It never logs credentials or sends test emails.
4. `--verify` additionally executes a real worker cycle. Use it before students subscribe, or understand that an enabled worker can send to current subscribers during delivery hours.
5. Confirm the admin transport status, Cron run history and worker errors. Preview a real course topic without sending. Subscribe with an individual account to begin receiving mail.

Paid upgrade: purchase the desired Brevo email tier, then increase the newsletter daily cap in the admin panel. No news-provider or AI subscription is required. Keep a credit reserve for account emails. No billing or plan upgrades happen automatically.

## Tests

Run `npx vitest run src/features/newsletter`. The tests use mocked mail/news endpoints and do not send mail. Run `supabase/tests/course_newsletters.sql` against a development database to verify permissions, recipient isolation, opt-out, caps and lease behavior; fixtures are rolled back.

## Pause / remove

Turn off delivery in the newsletter admin panel for an immediate pause. To remove the feature permanently:

1. Pause delivery and unschedule `campus-course-newsletters`. Check pending/unknown Brevo campaigns before deleting anything.
2. Delete the Brevo webhook whose URL ends in `/course-newsletter?action=events`, the `Hynox Course Newsletters` folder/lists, and campaigns whose IDs are recorded in `learning.newsletter_batches`. Their names use `Hynox YYYY-MM-DD <batch UUID>`; paid campaign tags are intentionally not used. Preserve contacts used by other features.
3. Delete the `course-newsletter` Edge Function. Run `supabase/features/course-newsletters/remove.sql` after exporting any desired history. This removes newsletter data and its Vault entries only; it retains shared extensions, all courses, users and enrollments.
4. Remove `src/features/newsletter`, `src/app/admin/newsletters`, `src/app/student/newsletters`, `supabase/functions/course-newsletter`, and `scripts/newsletter-setup.mjs`. Remove the newsletter navigation entries and their click handlers from the admin and student consoles. Also remove the student console's newsletter component import/render, visited state, and newsletter tab/query/title cases. Uninstall `fast-xml-parser` if nothing else uses it. The TypeScript `allowImportingTsExtensions` option can also be removed if unused.

Preserve migration history; do not delete an already applied migration. Use a new removal migration for a permanent database uninstall.
