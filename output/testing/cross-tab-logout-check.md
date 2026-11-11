# Cross-tab logout fix

26 October 2026 — Asia/Kolkata

The user confirmed that invalid/missing CSV fields and duplicate accounts were rejected. Single onboarding and direct Google activation were manually exercised. The remaining observed logout issue was an already-rendered dashboard remaining usable for local tab navigation until refresh.

The successful server sign-out now returns the allowed login destination. All logout controls, including the public hub, notify other tabs only after the server operation succeeds. BroadcastChannel and a browser storage event carry the notification; focus/pageshow marker checks cover suspended tabs and cached-page restoration. The root boundary clears both dashboard caches, unmounts private content and fully navigates to login, discarding the client router cache. A failed sign-out shows a safe error without notifying other tabs. No auth credentials are placed in the browser message.

Automated checks cover storage/channel notifications, current-tab notification, ordinary/shared destinations, malformed/unsafe messages, duplicate events, old markers, resume behavior, listener cleanup, failed sign-out and rejection of protected onboarding actions without a current user. These are simulated browser/authorization tests, not a completed real two-browser-tab sign-off.

## Manual retest

- [ ] Hard-refresh both existing tabs once so both load the updated code.
- [ ] In the same browser profile and same application origin, sign in and open two dashboard tabs.
- [ ] Sign out in the first tab. Both tabs should automatically reach login without refreshing the second tab. Old dashboard content should disappear.
- [ ] Repeat with the second tab in the background; it should show login on return.
- [ ] Press Back, then attempt navigation or a protected action. Private data/actions must remain unavailable.
- [ ] Sign in again and verify the previous logout marker does not immediately log out the new session.
- [ ] Repeat with the shared login; both tabs should reach /super-admin-login.

Notifications apply to the same app origin and browser profile. Separate browser profiles/incognito sessions are separate contexts. Requests already authorized before logout are not undone by this UI notification. Previously issued tokens and the remaining wider database permission findings still require their separately documented production review.

Next area: institution and user management — campus scoping, profile validation, suspension/reactivation, role changes, safe deletion, dependency handling and self/last-super-admin protection.
