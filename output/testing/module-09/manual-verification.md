# Brave verification — 29 October 2026

Selected workflows verified. Sandbox execution is excluded at the user's request. No production approval is implied.

## Passed so far

- Native Brave access recovered; Student account displays Test Student in Hynox QA Campus.
- Existing QA M56 cohort remained intact. A separate retained QA M789 course was added with one lesson, a required quiz, a required project and an optional quiz (manifest beside this report).
- New course and all three activities appeared without reloading the page. Activity counts settled after the course list updated; no latency benchmark claimed.
- Student lesson text rendered and its completion control worked.
- Course sidebar showed **1/1 lessons, 33.33%, 0/2 required activities** after completing the lesson, rather than falsely showing 100%.
- Required quiz rendered single choice, multiple choice, true/false and a labelled short-answer field, with a server-backed timer.
- A deliberately blank attempt returned **0/8, Not Passed**. Once the refresh settled, the page showed **1/1 attempts** and explicitly locked further retakes.
- Project overview, difficulty, estimated hours and maximum score rendered correctly. Empty repository URL produced visible validation feedback. A malformed repository URL did not create a submission; its transient server feedback was not captured, so that message is not marked passed.
- A valid synthetic repository URL and notes submitted successfully. The Student page displayed its submission time, pending mentor review, disabled fields and **Submission Locked**.
- Project overview inspected at 320 px and 375 px using Brave's responsive toolbar: content stacked, text wrapped, mobile navigation remained available and no clipped primary content was observed. This does not certify every mobile browser/device.
- Project layout also inspected at 768 px. The 375 px navigation drawer opened and navigated successfully to the quiz list; quiz cards and their status/score badges fit the phone viewport.
- Teacher dashboard showed the QA project in the pending evaluation queue, and its review drawer displayed the submitted URL and notes.
- Manual testing exposed a wrong project passing-mark fallback (50 instead of configured 60). Both shared project submission projections now return the stored passing score. Two new regressions failed before the fix and passed afterwards. Teacher drawer then displayed **60**.
- Teacher approved the synthetic project at **90/100** with feedback; the drawer closed and the project list displayed **approved**.
- Teacher Quiz Auditor displayed the blank quiz as **0/8, Failed** and rendered all four questions, including both multiple-choice answer keys and the short-answer review.
- Teacher approved one retake through the ordinary failed-attempt drawer. A database read confirmed exactly one approval record; the original failed attempt remained in the audit history.
- Teacher created **QA Optional Teacher Project**, saved it as a draft, scheduled/published it to the existing QA cohort, and edited its title to **QA Optional Teacher Project Updated**. The published catalog displayed all four QA activities, with correct optional/required flags.
- The activity console header was clipped inside an animated dashboard ancestor. The drawer now renders through a page-root portal; its regression failed before and passed after. Brave retest confirmed the complete header and accessible close button are visible.
- Student's granted **attempt 2** started successfully. Single choice, both multiple-choice selections, true/false and a case/whitespace-varied short answer submitted as **8/8, Passed**. The page prevented unnecessary further attempts after passing.
- The retake counter label still displayed the base limit despite enforcing the approved allowance correctly. Its denominator now uses the same effective allowance as the Start button. Brave retest displayed 2/2 correctly.

## Bugs found during this manual continuation

- Project passing marks were omitted from staff submission lists and replaced by an incorrect UI fallback. Fixed and manually retested.
- Teacher, Admin and Institution Admin quiz summaries inferred pass/fail from incompatible raw point scales, including a missing-threshold fallback that could label failed work as passed. They now use the persisted grading verdict and the attempt's own maximum score. Teacher's failed attempt was manually retested.
- Retake approval UI was restricted to forfeited attempts. It now also appears for ordinary closed failed attempts; a regression covers the eligibility rule. Manual approval succeeded and exactly one credit was confirmed.

## Still pending

Simultaneous multi-browser editing, live changes inside an already open review detail, production load/retries and exhaustive devices remain unverified. Sandbox is excluded.

## Fixture configuration

The pre-existing QA M56 cohort has no attendance start/end dates. Its existing attendance warning appears during dashboard refreshes; this is not evidence of a progress calculation failure.

## Final Student and Admin continuation

- Student syllabus showed 100%, 1/1 lessons and 2/2 required activities. Optional quiz and optional project remained assigned and unfinished.
- Student project detail displayed Approved, 90/100, exact Teacher feedback and locked submission.
- Admin campus selection loaded the creation form and published catalog with correct required/optional flags and thresholds.
- Admin quiz performance exposed a score denominator bug (8/100). The shared activity console now uses quiz question points; a new regression passes and Brave retest displayed 8/8 with Completed.


- Institution Admin QA cohort filter: one Student, 50% average course progress, 50% quiz pass rate and 100% project approval. Selected checks passed across all four roles; not exhaustive dashboard certification.
- Final suite: 519 tests / 70 files passed. One parallel run had UI timing failures; retained in tests-resource-contention.log and superseded by the clean rerun.


