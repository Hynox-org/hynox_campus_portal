# Module 03: institution and user management

Checked 26 October 2026 against the local Next.js app and the connected Hynox Campus Supabase project `ivuxikqspzdjmgoxcnqu`.

**Result: the implemented management flows and listed regression checks passed. Production security approval remains blocked by the wider delivery policies listed below.** This is a scoped test result, not a claim of zero bugs or unlimited capacity.

## Four normal account checks in Brave

| Account | Actual role | Observed result |
| --- | --- | --- |
| devtest.8031@gmail.com | Super Admin | Institution list, profiles, create/edit form and campus user directory loaded. The refreshed roster showed the new Institution Admin and Student. |
| akshaykumar07.m@gmail.com | Institution Admin | Own campus dashboard and enrolled-student roster loaded. A direct Admin management URL redirected to the Institution Admin dashboard. |
| akshay.m.cse.2022@snsce.ac.in | Teacher | Instructor dashboard loaded with zero assigned cohorts, consistent with its current assignments. A direct Admin management URL redirected to Teacher. |
| akshaykumar7.m@gmail.com | Student | Student dashboard showed the correct name/campus and no active group, consistent with current enrollment. A direct Admin management URL redirected to Student. |

Shared login was not used as a normal-role test account. Its existing multi-role record is still included in campus counts, so role totals can overlap.

## Live management and data checks

- Created disposable campus `M3-UI-20261026` through the normal Admin form. Verified its code, default onboarding status, website and multiline address in Supabase and the profile drawer.
- Attempted to save a `javascript:` website. The saved website and status remained unchanged. Replaced it with a valid HTTPS URL and set Active; both changes saved and appeared in the drawer.
- Switched between the empty disposable campus and the existing campus. The empty directory showed zero counts, and the existing campus showed its own records.
- Inspected the new roster, filters, profile drawer and pagination on desktop and at 390 × 844. Table columns scroll horizontally; the profile metadata fits the mobile drawer. Profile and delete controls now have accessible names.
- Removed the disposable campus using `institution.delete_managed_institution`. Verified zero matching test campuses remain and all four normal accounts remain intact. No invitation email was sent by these campus tests.
- User removal was checked with rolled-back Auth/core fixtures. The previously requested removal of the 07.m Student account also completed through the guarded operation; the user subsequently re-invited that address as Institution Admin.

## Fixes and performance changes

- Campus create/edit/delete and user deletion refresh the shared Admin data cache. A deleted campus also clears active management selections.
- Directory requests discard results from an older campus selection. A network failure clears the loader and shows an error.
- Reused the existing paginated DataTable: a 2,500-user fixture renders 10 user rows per page, rather than 2,500 rows at once. Tests cover page navigation and that view/delete actions target the displayed user.
- The directory service reads bounded 500-row cursor pages, avoiding the default 1,000-row truncation.
- Teacher primary-campus, course-mapping and campus-mapping lookups run concurrently, followed by one institution lookup. That reduces their dependent network stages from four to two.
- User role and campus lookups run concurrently after identity validation. Authorization is retained; no browser-trusted role is used.
- The delete dialog now explains that linked records prevent deletion. Failed dependency checks keep deletion disabled, rather than displaying zero linked records.
- Institution validation normalizes input, validates IDs/status/HTTP links, supports multiline addresses, and rejects duplicate codes regardless of case.

These are verified changes to query scheduling and rendered data volume. No browser p95 or production concurrency result is claimed.

## Database access regression checks

`supabase/tests/module_three_management.sql` passed against the connected database; synthetic records, role changes and test deletions rolled back. Cases include normal roles versus Super Admin, other-campus reads, direct write denial, anonymous catalog access, case-variant codes, unsafe URLs, guarded institution/user deletion, preservation of unrelated records, own-admin protection and last-active-admin removal/suspension protection.

Additional checks cover denial of self-granted campus mappings, anonymous/global teacher directory calls, another teacher identity, unmapped campus access, and suspended campus access. Teacher detail RPCs have explicit caller checks and fixed search paths; public wrappers use invoker permissions. The old teacher-program query also had invalid column references and a dummy condition, which were removed.

Applied migrations:

- `20261026130930_module_three_institution_user_management.sql`
- `20261026171643_module_three_access_boundaries.sql`
- `20261026172535_module_three_directory_status.sql`

## Verification

- Code suite: **343 tests passed in 40 files**.
- Production build: passed, including Next.js TypeScript and route generation.
- Focused ESLint on the new management components/services/tests: passed.
- `git diff --check`: passed (an existing CRLF conversion warning remains).
- Standalone `tsc --noEmit`: still reports existing scratch/test typing errors in unrelated integration, career, newsletter and navigation test files. It is not recorded as a clean gate.

## Remaining release risks and test limits

The latest Supabase advisor still reports **11 exposed delivery tables without RLS**, including cohorts, enrollments, cohort teacher assignments, progress and attendance. Those tables can influence teaching/enrollment scope, so the whole system must not be approved for production until their direct Data API permissions and policies are secured and tested. See [RLS advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) and `security-advisor-summary.json` beside this report.

There are also older anonymous definer RPC, mutable search-path and Auth configuration warnings outside the changed management paths. Authenticated definer-function warnings include intentionally guarded management operations; execution grants alone do not establish a vulnerability, and their authorization was tested here.

Teacher has no assigned cohort and Student has no active enrollment. Their populated teaching/learning workflows are not covered by these empty-state role checks; they belong to the delivery and learning module passes. Other role-specific mobile learning screens, real-device testing, high-concurrency load, offline recovery and a production latency baseline remain unverified. Real destructive UI submissions were not used; guarded database operations and rolled-back regression cases verified deletion behavior.
