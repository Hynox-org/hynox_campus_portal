# Dashboard checks and remaining test areas

The earlier Module 01–02 screen pass was checked on 26 October 2026 with the normal Admin account in Brave. The four requested Admin > Onboarding subtabs were checked; Teacher Assignments was excluded as requested. Invitation counts and empty tables below describe that earlier pass, before the later Teacher and Institution Admin test accounts were prepared.

| Subtab | Desktop | Mobile 390 × 844 | Data/function check |
| --- | --- | --- | --- |
| Onboarding Status | Loaded | Loaded, filters fit, table scrolls | Total 2, accepted 2, pending/expired/failed 0 matched database; empty Pending filter worked |
| CSV Onboarding | Single and Bulk forms loaded | Fields, upload and preview fit | Required data prevented empty submission; CSV parser, permissions, 2,500-row capacity and invitation queue tested separately |
| Teacher Onboarding | Form loaded | Form and status table fit | Empty invitation table expected; actual teacher invitation not sent in this review |
| Super Admin Onboarding | Navigation and form available | Form and empty table fit | Required fields prevented empty submission; privileged invitation path checked in SQL/action tests |

The invitation tables now show each invitation's actual state. Failed and revoked invitations no longer appear Pending or Accepted because of an active account; expired pending invitations show Expired. CSV and Super Admin form headers stack on narrow screens. There were no existing teacher or Super Admin invitations to inspect as populated rows. No new email or privileged account was created in this review.

The original testing plan lists **41 feature areas**. Login/sign-out, single and CSV onboarding, invitations, and Super Admin onboarding account for **5 areas already worked through** in Modules 01–02. Institution profiles and user directory add **2 areas worked through** in Module 03. **34 areas have not started their dedicated module pass.** “Worked through” means scoped code, database and available UI checks; it does not mean every role or production condition has passed. Public signup (area 02) remains partial, shared dashboard chooser (03) is deferred as requested, and teacher campus mappings (10) remain outside this pass.

The next dedicated pass should cover reusable course blueprints and instantiation, followed by programs, courses, cohorts, enrollment and teacher assignments. Run each against isolated test accounts and at least two campuses, then complete the learning, assessment, attendance, resume, newsletter and public areas in the [41-area plan](../../pdf/Hynox_Campus_Two_Day_Test_Plan.pdf).

Module 03 continuation: all four normal Google accounts were exercised in Brave, normal roles were redirected away from Admin management, a disposable campus was created/edited/removed, and the roster/profile drawer was checked at mobile width. The latest suite passed 343 tests in 40 files. See [the updated Module 03 report](module-03/report.md) for exact coverage and open release risks. Its management regression checks passed; production security approval remains blocked by delivery tables without RLS. The 34 other areas still need their own dedicated pass.
