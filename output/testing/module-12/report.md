# Module 12 Strict mode

30 October 2026. Scope is quiz Strict mode only. Module 11 coding challenges and challenge Strict mode are completely excluded.

## Trace and changes

Student Start → browser fullscreen permission → start/session actions → protected quiz RPCs. Browser violation listeners → warning/grace state → forfeit action or unload beacon → learning.finish_quiz → attempt, answers and authoritative progress.

1. Paired fullscreen and visibility events could consume the first warning twice before React rendered. A synchronous warning ref now coalesces that departure until recovery or expiry.
2. A failed forfeit write disabled local listeners without preserving a reliable pending state. The quiz now stays locked, blocks normal answer submission, retries every five seconds and retries on reconnect until the server confirms the result.
3. The unload endpoint now rejects cross-origin requests, malformed JSON, oversized bodies, malformed IDs and invalid reason lengths. Error responses do not expose raw database failures.
4. Successful submission cleanup clears warning state before fullscreen exit. Fullscreen permission is still requested before consuming an attempt.

## Passed

- Component cases: fullscreen denial consumes no attempt; paired events produce one warning; recovery retains the used warning; second departure forfeits; grace expires after 15 seconds; failed forfeit stays locked and reconnect retries; successful submission exits without a false violation.
- API cases: valid same-origin beacon, rejected foreign origin, malformed JSON/ID and excessive reason length.
- Rolled-back SQL fixture: another Student cannot forfeit the attempt, a valid forfeit closes at zero with failed status, repeated forfeits preserve the saved result and forfeits do not count as course completion.

## Failed then fixed

Double-counted browser events and the failed-forfeit escape path were corrected, with runnable component regressions. Endpoint input/origin checks were strengthened.

## Blocked and untested

S1-S8 in the manual checklist require the owner's real Brave session. Fullscreen, tab close, browser crashes and unload delivery are not certified by jsdom. Client-side Strict mode is not proof against a compromised browser. Coding and challenge forfeits were not tested or changed. Production load and broader delivery RLS remain outside this pass.

Evidence: database-integration.sql, database-result.json, component-tests.log, final-ui-tests.log, src/app/api/quiz-forfeit/route.test.ts and shared final validation logs.
