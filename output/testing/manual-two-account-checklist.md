# Manual login and onboarding checks with two Google identities

Reset completed: 26 October 2026, Asia/Kolkata.

## Preserved accounts

- devtest.8031@gmail.com — active super admin.
- superadmin.campusportal@gmail.com — active shared login with super-admin, institution-admin, teacher and student role selections.

Removed: 9 application accounts, 8 Auth accounts, 10 role assignments, 3 invitations and 2 sessions, with linked personal records. Refresh tokens for removed accounts were deleted. Storage contained no objects. Shared institutions, programs/courses/lessons, cohorts, templates, activities and system role definitions were preserved and their row counts verified unchanged.

Deleting accounts does not revoke already issued access tokens immediately. They can remain valid until expiry; deleted identities no longer resolve to application roles. The existing RLS gaps in other modules remain a production release concern. This reset is not a promise of erasure from external provider logs or database backup retention.

## Set up your two test identities

**Admin A:** devtest.8031@gmail.com, in your normal browser profile.
**Test B:** another Google email you control, in a separate browser profile/private window. It must not be either retained admin account.

If your only usable identities are the two retained admins, you cannot test genuinely new onboarding while retaining both unchanged. Shared role switching can test existing dashboard access, but a clean additional Google identity is required for first activation.

Use the updated local application. Confirm that its Google callback returns to the same configured application URL. The application source has not been deployed to production. The local email worker has now been started and both manually requested invitations were confirmed delivered by Brevo. Future npm run dev starts the web server and email worker together. Production needs a supervised persistent worker.

## First pass: Student onboarding and login

- [ ] In a signed-out private window, open /admin, /institution, /teacher and /student directly. Expect login without private dashboard content.
- [ ] Sign in as Admin A. Confirm the admin dashboard works after a refresh.
- [ ] Before Test B ever signs in, invite Test B as a Student into the test institution. Confirm one invited user, one student role and one pending invitation.
- [ ] Do not let Test B sign in before provisioning: a normal public signup would create an active public account, and onboarding correctly refuses to repurpose an active account.
- [ ] Submit the same pending onboarding again, including a different email letter case. Expect the same pending invitation/token, not another user or role.
- [ ] Copy the old invitation link. Regenerate it once before activation. Confirm the old link fails and the new link is usable.
- [ ] For email testing, start the configured worker with a controlled sender: npm run onboarding:worker. This command sends real queued invitations. A queued status alone does not mean an email reached the inbox.
- [ ] Confirm queued → processing → sent and inspect the email in Test B's inbox. Sent means provider acceptance; inbox delivery must be checked separately.
- [ ] Open the latest invitation in Test B's separate browser profile. Explicitly select Test B in Google's account chooser.
- [ ] Expect the Student dashboard. As Admin A, refresh the invitation list: expect accepted status and one active linked student account.
- [ ] Refresh Test B's dashboard, sign out and sign back in. Expect the same account and role, without duplicate users/invitations.
- [ ] As Test B, enter /admin, /institution and /teacher directly. Expect denial or redirection, with no private data from those roles.
- [ ] Open two Test B tabs. Sign out in one, then refresh or perform a protected action in the other. The action must be denied. Record any previously rendered content visible until refresh.
- [ ] Press Back after sign-out, then refresh or attempt a protected action. Expect no new authorized data access.
- [ ] Reopen an accepted invitation. It must not create a second account or reset status to invited.

## Second pass: Wrong identity and negative inputs

Before activation of a fresh Test B invitation:

- [ ] Open it while choosing Admin A in Google. It must not activate Test B or acquire Test B's role. Admin A may return to its own existing admin dashboard; that is expected.
- [ ] Change the token or email in the link. Expect a safe error without activation.
- [ ] Cancel Google consent and retry. Expect a useful error/retry path.
- [ ] Try invalid CSV headers, a missing name/email, an invalid email, duplicate/case-variant email rows, an unsupported role and another institution ID. Expect validation or authorization errors.
- [ ] Expiry, suspended/deleted accounts, provider outage and worker crashes require deliberate test setup. Arrange these on isolated test data rather than changing the retained admin accounts.

## Repeat with one reusable Test B account

Order: Student → Teacher → Institution Admin → Super Admin. Trainer and Mentor can be checked the same way if those workflows are exposed.

Between roles, sign Test B out and remove only Test B's application account, Auth identity, roles, invitations and personal records through the existing admin delete control, or request a targeted Test B reset. Never delete Admin A or the retained shared account.

Do not simply onboard the active Student again as Teacher: refusing that change is intentional. It prevents accidental privilege/campus changes.

For each clean role cycle:
- [ ] Invite Test B before signing it in.
- [ ] Activate using Test B's Google identity.
- [ ] Confirm the intended destination: Teacher/Trainer /teacher; Institution Admin /institution; Super Admin /admin; Mentor uses the existing public workspace.
- [ ] Check direct access to the other dashboards against that role's permissions.
- [ ] Repeat sign-out, refresh and two-tab checks.

When Test B is Institution Admin:
- [ ] Attempt onboarding a teacher or super admin. Expect denial.
- [ ] Attempt student onboarding into another institution. Expect denial.
- [ ] Creating and activating an additional student while keeping an institution-admin identity signed in requires a third clean identity. With two identities, the forbidden operations can be checked; positive nested activation needs another account.

The shared login may separately be used to select each assigned dashboard. Expect only its configured role choices; this is not a substitute for testing normal single-role accounts.

## Production sign-off is still pending

Automated checks passed: 265 application tests, production build, real-role SQL security/regression checks and a 2,500-user synthetic database run. Security hardening was performed for Modules 01 and 02. That does not mean the entire Supabase project was tested or has no backlog.

Outstanding before production approval:
- [ ] Complete real Google/browser and two-account checks above.
- [ ] Deploy the updated application; database migrations are already live.
- [ ] Run the email worker persistently with automatic restart and queue monitoring; verify actual delivery and failure/recovery.
- [ ] Verify production OAuth redirect URLs, secure cookie behavior and applicable Auth rate-limit/password-protection settings. Leaked-password protection was reported disabled.
- [ ] Measure full browser/network import duration and simultaneous imports on staging. The 15.1-second result measured sequential database work only.
- [ ] Rectify remaining project-wide RLS-disabled delivery/academic tables and anonymous privileged functions before exposing the broader application to production.
- [ ] Review standalone repository TypeScript/lint failures outside the checked module scope.
- [ ] Harden the existing admin UI delete-user action before production: it currently performs several separate writes, ignores some intermediate errors and has no explicit self/last-super-admin protection. This cleanup used a separately rehearsed, atomic transaction; it did not establish that the UI deletion workflow is production-safe.

Public Google signup remains enabled in the existing application behavior. A deleted identity that signs in again can create a fresh public profile; it does not regain its former roles. Invite Test B first to avoid creating that public profile during onboarding tests.

The previous ambiguous duplicate-email group was removed by the authorized account reset; it is no longer an outstanding account-cleanup item.

Record each manual result as PASS / FAIL / BLOCKED, with the account role, URL, expected behavior and actual behavior. Never include passwords, tokens, service keys or unredacted private student data in screenshots.

