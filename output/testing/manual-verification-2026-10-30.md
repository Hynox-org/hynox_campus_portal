# Manual verification for Projects Strict mode Attendance and Analytics

30 October 2026. Run these checks yourself in Brave. Coding challenges, challenge execution and challenge strict mode are excluded. Today's browser checks have not been performed by Codex. The automated and database evidence is recorded separately.

## Safe test setup

1. Use an isolated QA course and cohort, not a real class. Keep the four existing account roles unchanged.
2. Admin: create or select a QA cohort with a valid date range that includes yesterday, today and tomorrow. Assign its course, one Teacher and one Student. Ensure the program, course and lessons are active and campus-visible.
3. In that course use one text lesson, one required quiz and one required project. Set quiz and project maximum score to 100 and passing score to 60. Give the quiz four question formats with a total of 8 question points. Add a second optional quiz and leave it unattempted.
4. Make additional Strict mode test quizzes optional so they do not change the required-progress example. Use separate quizzes for expiry, second violation, tab close and normal submission. Do not use coding challenges.
5. Keep the project repository URL synthetic, such as https://github.com/hynox-qa/manual-project. Record the actual QA course/cohort/activity titles you used.

## Projects

| Case | Action | Expected result |
| --- | --- | --- |
| P1 | Student opens the assigned project; try submitting an empty URL, an incomplete GitHub URL and a non-HTTPS URL. | Clear rejection; no saved submission and no completion credit. |
| P2 | Submit a complete HTTPS GitHub repository URL and notes. Reopen the project. | One pending submission, saved URL/notes, visible submission time and locked resubmission. |
| P3 | Teacher opens the assigned cohort's review queue. | Correct Student and repository; maximum 100 and configured passing score 60. Another cohort's work is absent. |
| P4 | Try a negative score and 101; then request revision with score 40 and recognizable feedback. | Invalid grades rejected. Revision and exact feedback saved; required activity remains incomplete. |
| P5 | Student opens the revision, edits URL/notes and resubmits. | Form unlocks for revision, one submission is updated, old review clears and status returns to pending. |
| P6 | Teacher approves at 90 with recognizable feedback. Student reopens it. | Approved, 90/100, exact feedback and locked form. Required activity contributes to progress. |
| P7 | Keep Student's project detail open in another session. Teacher changes the review feedback. | Open detail refreshes without a page reload. Allow the protected update/recovery cycle; report the observed delay. An unsent Student draft must survive a background update. |
| P8 | Disconnect before a submission/review save, then reconnect and retry. | Failure is visible. Retry must not create duplicate submissions/reviews or reset the submission date of an identical pending submission. |

## Strict mode for quizzes only

| Case | Action | Expected result |
| --- | --- | --- |
| S1 | Deny fullscreen permission when starting a strict quiz. | Start is rejected visibly and no attempt is consumed. |
| S2 | Start a strict quiz, exit fullscreen once, then return within 15 seconds. | One warning; resume without immediate forfeit. Paired fullscreen/tab events from that departure must not count as two violations. |
| S3 | On a fresh quiz, exit fullscreen and remain outside for more than 15 seconds. | Attempt closes as forfeited, score 0, failed and not course-complete. |
| S4 | After using the first warning and returning, leave fullscreen or switch tabs again. | The second departure forfeits the attempt. |
| S5 | Submit a fresh strict quiz normally. | Normal grade is shown. Exiting fullscreen during successful cleanup must not create a forfeit. |
| S6 | On a fresh strict quiz, close/reload the tab mid-attempt, then reopen it. | The unfinished strict attempt cannot be resumed for extra work. It is closed through the beacon or server recovery path, and the Teacher sees a zero-score forfeit. |
| S7 | Disconnect just before a forfeit is saved; reconnect afterward. | Quiz stays locked while confirmation is pending. Answers cannot be submitted to bypass the violation. Reconnect triggers a retry and the saved result remains forfeited at zero. |
| S8 | Exhaust the attempt allowance; Teacher approves one retake. | Exactly one additional attempt becomes available; original history remains and the counter includes the allowance. |

Fullscreen support and browser unload behaviour require these real-browser checks. Client-side Strict mode does not prove that a compromised browser cannot bypass proctoring.

## Attendance

Attendance dates use Asia/Kolkata for both browser and server. Rate is (present + late) / (present + late + absent), using marked elapsed working days after enrollment. Unmarked days are not automatically absent; no marks displays 0%.

| Case | Action | Expected result |
| --- | --- | --- |
| A1 | Admin/assigned Teacher opens the QA cohort register. Switch institutions/groups and revisit. | Correct roster and dates; no data from the previous selection. Missing dates show an actionable configuration message. |
| A2 | Teacher marks today's Student present, then late, then absent; reopen the register each time. | Latest mark persists once, with no duplicate session/record. Only the mapped Teacher can edit. |
| A3 | As Teacher try yesterday and tomorrow. As Admin try an elapsed date and a future date. | Teacher edits only today's date. Admin can correct elapsed dates inside the cohort range. Future dates are read-only for everyone. |
| A4 | Mark a date as holiday, try marking attendance, then explicitly remove the holiday. | Holiday excludes that date from statistics and blocks marks. Removing it reopens a working day. Existing marks are retained but ignored while holiday is set. |
| A5 | Using an older QA enrollment with three elapsed working dates after joining, Admin records one present, one late and one absent. | Student and staff statistics show 66.7%. Future, holiday and pre-enrollment dates do not affect that example. |
| A6 | With more than 50 QA students, navigate Previous/Next students and change the sheet month. | At most 50 students per page; sheet shows one month. Correct Student is edited on later pages. Bulk All still applies to the full eligible roster, not just the visible page. |
| A7 | Keep another staff register/Student attendance panel open and save a mark elsewhere. | Protected refresh updates it without a full page reload. Student sees only their own attendance. Institution Admin statistics remain campus-scoped. |
| A8 | Disconnect while marking; reconnect and use Retry if required. | Failure is visible, the optimistic mark rolls back, controls recover and a retry saves once. A failed read must not appear as a genuinely empty roster. |

## Analytics and Student drilldown

Quiz outcome charts count distinct assigned Student/quiz pairs. A failed attempt followed by a passed retake is one passed outcome. Historical attempts remain available in the audit views. Average scores use each quiz's question-point denominator, not its activity scale.

| Case | Action | Expected result |
| --- | --- | --- |
| N1 | Institution Admin selects the QA cohort with one Student. | One Student in scope. Other cohort/campus results do not appear. |
| N2 | Fail the required 8-point quiz, approve a retake, then pass 8/8. Leave the optional quiz untouched. | For those two quizzes: two eligible slots, one passed and one not attempted; quiz engagement 50%. Pass rate and average score across finalized current outcomes are 100%. Retake does not add a third slot. |
| N3 | Begin but do not submit an additional quiz. | It appears as In Progress, not Failed, and is excluded from finalized-score averages. |
| N4 | Put the same Student in two QA cohorts with different assignments; switch the cohort filter. | The selected cohort shows only its assignments and results. Across cohorts the Student has one ranking row and equal weighting. |
| N5 | Complete the one text lesson, pass the required quiz and obtain project approval; keep optional work unfinished. | The example course reaches 100%, with 1/1 lessons and 2/2 required activities. Other unfinished courses can keep a program/cohort average below 100%. |
| N6 | Open Student drilldown and expand a course's syllabus. | Only assigned courses appear; lesson lists load on expansion. Quizzes Cleared counts passed quiz outcomes, and 8/8 is 100%, not 8%. |
| N7 | Change a grade/feedback while a staff report or drilldown stays open; reconnect after temporarily losing the network. | Progress and report queries refresh, or show a recoverable error. No silent empty report, duplicate ranking or lost edit. |
| N8 | Check 320px, 375px, 768px and desktop widths. | Navigation, forms, grades and feedback remain usable. Wide attendance sheets scroll inside their table; action controls and pagination remain accessible. |

## What to send back

Send the passed case IDs and a short entry for every failed or blocked case:

```text
Case ID:
Role:
QA cohort/course/activity:
Browser and screen width:
Steps performed:
Expected:
Actual and exact visible error:
Reproduces after reopening: Yes / No
Approximate refresh delay:
Screenshot if useful:
```

Do not include passwords, verification codes, access tokens, API keys or private browser console request headers. A blocked check is not a passed check. Coding challenge checks are excluded entirely.

