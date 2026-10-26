from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfbase.pdfmetrics import stringWidth
from pypdf import PdfReader
from pathlib import Path
from xml.sax.saxutils import escape
W,H=595.276,841.89
OUT=Path('output/pdf/Hynox_Campus_Two_Day_Test_Plan.pdf')
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Hynox Campus Two Day Testing and Performance Plan');c.setAuthor('Hynox Campus')
navy=HexColor('#172554'); gray=HexColor('#475569'); light=HexColor('#e2e8f0'); y=0; fields=[]; page=0

def wrap(text,width,size=10,font='Helvetica'):
 words=text.split(); lines=[]; line=''
 for word in words:
  trial=(line+' '+word).strip()
  if stringWidth(trial,font,size)<=width:line=trial
  else:
   if line:lines.append(line)
   line=word
 if line:lines.append(line)
 return lines

def text(t,size=10,leading=14,bold=False,x=44,width=507,color=black,gap=7):
 global y
 c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.setFillColor(color)
 for line in wrap(t,width,size,'Helvetica-Bold' if bold else 'Helvetica'):
  c.drawString(x,y,line);y-=leading
 y-=gap
 assert y>=43, f'Content overflow page {page}: {t[:60]}'

def start(title,kicker):
 global y,page
 if page:c.showPage()
 page+=1;y=H-49
 c.setFillColor(navy);c.rect(0,H-11,W,11,fill=1,stroke=0)
 text('HYNOX CAMPUS  /  QUALITY PLAN',9,12,True,color=gray,gap=12)
 text(title,21,25,True,color=navy,gap=9)
 text(kicker,10,14,color=gray,gap=14)
 c.setStrokeColor(light);c.line(44,37,W-44,37)
 c.setFillColor(gray);c.setFont('Helvetica',8);c.drawString(44,24,'25-26 October 2026  |  Asia/Kolkata  |  Planning checklist - no tests executed')
 c.drawRightString(W-44,24,f'{page} / 10')

def heading(t):text(t.upper(),11,15,True,color=navy,gap=7)
def check(t,id=None,size=10):
 global y
 name=id or f'check_{len(fields)+1:03d}';fields.append(name)
 c.acroForm.checkbox(name=name,tooltip=t,x=45,y=y-2,size=10,buttonStyle='check',borderWidth=.8,borderColor=gray,fillColor=white,textColor=navy,checked=False,forceBorder=True)
 text(t,size,14,x=62,width=489,gap=8)
def line(t):text(t,9,12,color=gray)

start('Two day testing and speed plan','Sunday 25 October and Monday 26 October 2026 | All four workspaces and shared services')
text('Purpose',12,16,True)
text('Verify Hynox Campus feature by feature, review the agent-written code, fix confirmed defects, and measure the reported lag before and after changes. The checklist includes 41 module groups and shared cross-cutting checks.')
heading('What the different tests mean')
for a,b in [
('U  Unit','A small function or component in isolation: for example, scoring a quiz answer or rejecting an oversized resume field. Dependencies are mocked where appropriate.'),
('I  Integration','Connected parts together: a server action, authentication, database constraints and policies, or an email/worker contract. Mocks alone do not prove database permissions.'),
('E  End to end','A real user journey through the browser, such as teacher assignment to student submission and review.'),
('S  Security','Try the wrong role, wrong owner, wrong campus, expired session and direct request. Hidden buttons do not prove access is denied.'),
('A  Accessibility','Keyboard navigation, labels, focus, announcements, contrast and narrow-screen use.'),
('P  Performance','Measure waiting, network requests, rendering, queries and concurrent work. Identify the bottleneck before changing code.'),
('C and R','C = read and review relevant code. R = rerun the failed case and nearby workflows after the fix.')]:
 text(a,10,13,True,gap=2);text(b,9.5,13,gap=9)
heading('How to use the checkboxes')
text('Mark a module complete only after code review, its applicable tests, the failure-path checks, any required fix and a regression rerun. A blocked or failed module stays unchecked and gets an issue ID in the evidence log. These are completion boxes, not promises that every test will pass.')
check('Confirm the two-day working window, tester and reviewer, and a separate test environment.')
line('Scope is comprehensive at feature-group level. New paths found during review must be added to the ledger; two days cannot guarantee every input combination or every defect is resolved.')

start('Day by day execution','Assumption: 8 working hours per day, excluding breaks. Rebalance within the same priorities when evidence changes.')
heading('Day 1 - Sunday 25 October')
for t in [
'1.0 h - Prepare fixtures and isolation; capture commit, environment and existing test/type/lint/build failures.',
'1.5 h - Review authentication, direct-request authorization, tenant boundaries, RLS and sensitive data handling across all modules.',
'3.0 h - Execute modules 01-20 on pages 3-5: account access, onboarding, library, academics and delivery.',
'1.0 h - Fix the highest-impact confirmed defects in shared code; add a small regression test for each non-trivial fix.',
'0.5 h - Record performance baseline for all dashboards and the slowest journeys using production-mode builds.',
'1.0 h - Rerun affected checks; record failed/blocked cases and agree Day 2 priorities.']:check(t)
heading('Day 2 - Monday 26 October')
for t in [
'3.0 h - Execute modules 21-41 on pages 6-8: progress, assessments, attendance, analytics, career and newsletters.',
'1.5 h - Fix and retest critical/high defects; include data integrity, duplicate submissions and worker recovery.',
'2.0 h - Profile the worst measured delays, apply the smallest useful fixes and repeat the same measurements.',
'1.0 h - Run role-specific end-to-end journeys, accessibility smoke checks and the final automated regression.',
'0.5 h - Finish the evidence ledger and pass/fail/blocked summary; decide whether the build is ready or needs more time.']:check(t)
heading('Priority and time limits')
text('P0: unauthorized access, exposed secrets, data loss or unsafe execution. P1: login failure, broken core workflow, wrong grades or duplicate mail. P2: serious lag, broken recovery or accessibility. P3: minor visual issues. Record expected impact and reproduction; do not use priority labels as proof of exploitability.')
text('If P0/P1 work exceeds the time budget, stop optional polishing and preserve incomplete checks. Do not deploy with unresolved critical security or data-integrity defects. Extend the plan with explicit owners and dates rather than silently reducing coverage.',9.5,13)

modules=[
('Login and sign out','U I E S','Valid/invalid password; Google callback success/error; expired session; missing business user; logout then Back.','Correct role landing; safe callback destination; protected routes deny stale/anonymous sessions.'),
('Public signup and invitation verification','U I E S','Missing/malformed fields; duplicate email; invalid, expired, reused or wrong-email token; interrupted acceptance.','Useful errors; no extra account/role; acceptance is consistent and cannot be replayed.'),
('Shared dashboard chooser','U I E S','Mapped/unmapped role; tampered role cookie/header; inactive account; refresh, deep link and sign out.','Only configured roles are selectable; client-supplied context does not grant extra privileges.'),
('Institution directory and profiles','U I E S','Valid/duplicate code; blank/long profile; status transition; invalid ID; delete with dependent records.','Correct validation and confirmation; no orphaned records; non-Admin/direct requests denied.'),
('Institution user directory and removal','I E S A','Search/filter empty and large roster; wrong campus ID; remove linked user; cancellation and retry.','Correct scoping; safe removal; clear empty/error state; no accidental unrelated deletion.'),
('Single user onboarding','U I E S','Each supported role; conflicting email role; missing institution; Institution Admin inviting staff or other campus.','Only allowed role/campus accepted; duplicate retry is safe; invitation mail failure is visible.'),
('CSV onboarding','U I E S','Empty/header-only; quoted commas; BOM/CRLF; malformed/oversized data; duplicate and mixed invalid rows.','Validate whole input before changes; reject unauthorized campus/role; no silent partial onboarding.'),
('Invitations and regeneration','U I E S','Tenant/status/date filters; expired/accepted invitation; wrong-tenant ID; repeated regeneration; Brevo failure.','Status and token lifecycle correct; old token invalidated as intended; no out-of-scope action.'),
('Super Admin onboarding','U I E S','Admin success; every non-Admin denial; duplicate/replayed invite; invalid fields and send failure.','Dedicated flow grants only intended role; no escalation through ordinary CSV or user invitation.'),
('Teacher campus mappings','I E S','Add/remove mapping; duplicate map; invalid teacher/campus; teacher mapped to multiple campuses.','No duplicate or orphan relation; teaching context updates and stale cache is invalidated.'),
('Reusable course blueprints','U I E S','Course/module/lesson/resource CRUD; categories/tags; published/draft; order; invalid URL; dependent deletion.','Correct hierarchy and publication rules; Admin-only writes; reads match actual published policies.'),
('Blueprint instantiation','I E S','Clone into valid/invalid program; empty blueprint; repeated request; resource propagation; mid-operation failure.','Complete hierarchy and correct tenant; no partial clone or unintended duplication; source retained.'),
('Programs and batches','U I E S','Create/edit/status/slug; duplicate and blank inputs; wrong tenant; program removal with courses.','Staff action plus database checks agree; correct sort/filter and safe dependent-record handling.'),
('Courses and instructor mapping','U I E S','CRUD; duplicate slug; invalid program; multiple/removed instructors; cross-campus staff IDs.','Only valid relations and permitted tenant; instructor list, syllabus and caches remain consistent.'),
('Syllabus modules and lessons','U I E S A','Empty/full content; reorder; lesson types and duration; long text; invalid ID; failed save and retry.','Stable order and data; staff controls work; Students cannot author through direct requests.'),
('Lesson media and supplementary resources','U I E S A','Markdown/script-like text; unsafe URL schemes; missing video/file; long URL; mobile/keyboard preview.','No script execution; safe links and fallback errors; external file access is handled separately.'),
('Cohorts and timelines','U I E S','Dates reversed/equal/missing; inactive cohort; multi-campus context; edit/delete with enrollments.','Date validation and lifecycle correct; verify broad staff action guards against intended permissions.'),
('Student enrollment and status','U I E S','Duplicate enrollment; inactive/wrong-campus student; status changes; remove/re-enroll; failed request.','No duplicate active relation; correct roster and access; no lost history or tenant leakage.'),
('Cohort course assignments','I E S','Duplicate assignment; wrong program/tenant; future/inactive course; remove while progress exists.','Correct course visibility and dates; safe dependency behavior; progress is preserved as intended.'),
('Cohort teacher assignments','I E S','Assign/remove teacher; duplicate; unassigned teacher request; context switch after removal.','Correct teaching scope and roster visibility; revoked assignment does not retain stale authorization.'),
('Lesson and course progress','U I E S','Start/complete twice; partial lesson; empty course; activity completion/rejection; concurrent updates.','Idempotent progress and correct totals; only intended student records change; completion recalculates.'),
('Activity definitions and deployment','U I E S','Quiz/project/code CRUD; publish/draft; invalid dates/scores; duplicate deployment; expired assignment.','Valid subtype and cohort links; availability enforced on server; no half-created activity.'),
('Quiz questions options and settings','U I E S','Question types; zero/multiple correct options; blank question; score limits; reorder/delete; strict-mode toggles.','Valid question rules and totals; correct answers are not leaked to an active Student attempt.'),
('Quiz attempts answers and scores','U I E S','Start/resume; unanswered/duplicate answers; exact pass threshold; timeout; double-submit; two tabs.','Correct grade, attempts and completion; one consistent final result; no other student access.'),
('Quiz retake approval','U I E S','Approved/denied role; wrong cohort; repeated approval; attempts at limit; previous forfeiture.','Retake state and attempt count correct; only intended reviewer can authorize; prior evidence retained.'),
('Project definitions and submission','U I E S','Valid/invalid repository URL; notes length; late/early submission; duplicate submit; rejected/revision resubmit.','Only eligible submissions accepted; latest allowed state shown; no overwrite of unrelated history.'),
('Project reviews grades and feedback','U I E S','Approve/reject/revise; score outside limits; empty feedback; duplicate or simultaneous reviews; wrong reviewer.','Authorized reviewer only; stable score and feedback; activity/course progress stays consistent.'),
('Programming challenges examples and tests','U I E S','Problem CRUD; zero tests; hidden/visible cases; wrong expected output; limits, languages and max attempts.','Only valid configuration accepted; hidden test data stays private; deleting cases preserves consistency.'),
('Challenge starter templates','U I E S','Admin, assigned/unassigned Teacher, Trainer, Institution Admin and Student; every language; availability edges.','Read/write rules match approved policy; explicitly resolve teacher-versus-trainer policy difference.'),
('Coding execution and submissions','U I E S','Correct/compile/runtime/timeout/memory errors; empty and large code/stdin; queue retry, worker crash and concurrency.','Safe sandbox; no network/files escape; no hidden-test leak; idempotent judging and accurate grade/logs.'),
('Strict mode and forfeit endpoints','U I E S A','Fullscreen/visibility loss; refresh/close; duplicate beacon; forged attempt/student ID; missing auth; completed attempt.','Only current owner/active attempt affected; no double penalty; recovery and instructions are accessible.'),
('Attendance register and records','U I E S','Present/absent/late; bulk/individual; invalid student; duplicate save; server midnight; past/future date.','Correct totals; Student cannot mark; Teacher date rules and Admin exception enforced server-side.'),
('Attendance holidays and statistics','U I E S','Set/remove holiday; Sunday; no sessions; zero denominator; same-campus unassigned teacher; cross-campus request.','Correct holiday/statistics math; verify assignment and same-institution fallback against intended access.'),
('Campus analytics and student drilldown','U I E S P','Empty campus/cohort; multiple groups; incomplete/forfeited work; score bands; roster filters and rank ties.','Metrics match source records; no NaN/double counting; correct tenant/owner; filter controls do not alter data.'),
('Saved resumes and builder','U I E S A','Every section/field; blank/long/unsafe content; copy/delete; stale version; offline save/retry; PDF with many entries.','Owner-only persistence; conflict preserves draft; one reference layout; selectable PDF has no lost/overlapping text.'),
('ATS scanner and saved history','U I E S','Builder/text/PDF; image-only/malformed/large PDF; 5 MB/10-page edges; optional Role/JD alone and together.','Correct extraction/term boundaries; null result for unknown terms; private history; raw files/text not retained.'),
('Student newsletter subscription','U I E S','Opt in/out; shared demo; inactive student; suppressed address; no eligible courses; simultaneous preference change.','Own preference only; consent recorded; no forced re-enable or suppression bypass.'),
('Newsletter administration and previews','U I E S A','Limits/hour/reserve boundaries; topic length; disabled course; feed error; preview; dashboard deep link/back/refresh.','Admin-only access; Newsletter last and embedded; URL synced; preview never sends mail.'),
('Newsletter scheduled delivery and suppression','U I S P','Stale/duplicate news; 429/feed fallback; no credits; opt-out race; worker overlap; timeout after send; webhook replay.','One eligible student/day edition; quota and suppression preserved; ambiguous send reconciled, never blindly retried.'),
('Lookup catalogs and runtime choices','U I E S','Inactive/unknown language/status; missing lookup; duplicate code; unsupported runtime; version label mismatch.','Valid choices only; no crash on missing data; catalog labels checked separately from actual sandbox images.'),
('Public and Mentor placeholder hub','I E S A','Public, Mentor and other roles; direct staff route/action; no tenant; unprovisioned/inactive user.','Correct limited landing; no assumed mentor teaching permissions; protected functionality stays inaccessible.')
]
assert len(modules)==41
for startidx,endidx,title in [(0,7,'Day 1 account and onboarding'),(7,14,'Day 1 administration and academics'),(14,20,'Day 1 content and delivery'),(20,27,'Day 2 progress and assessments'),(27,34,'Day 2 coding attendance and analytics'),(34,41,'Day 2 career and newsletters')]:
 start(title,f'Modules {startidx+1:02d}-{endidx:02d} | For every row: code review C, applicable tests below, then fix and regression R.')
 for n in range(startidx,endidx):
  name,types,inputs,expected=modules[n]
  check(f'{n+1:02d}  {name}',f'module_{n+1:02d}',10)
  text('Tests: '+types+'  |  Inputs: '+inputs,9.2,12,x=62,width=489,gap=3)
  text('Pass: '+expected,9.2,12,x=62,width=489,gap=11)
 line('Common negative cases: blank/null, wrong types/IDs, length limits, duplicate and concurrent requests, denied role/tenant/owner, failure/retry. Apply where relevant; record N/A with a reason.')

start('Performance and code review','Measure on Day 1; fix and compare on Day 2. Proposed internal targets below are provisional acceptance budgets.')
heading('Measure the reported lag')
for t in [
'Build and start in production mode; record machine/browser, commit, region, network and data volume. Keep development hot-reload timings separate.',
'Time cold login-to-dashboard, warm tab switches, cohort/course selection, Student Hub search, lesson opening, analytics, builder, scanner and coding results. Record 10 repeat runs per journey and median/p95.',
'Capture browser Network/Performance traces: request count and size, long main-thread tasks, React rerenders, navigation/loading behavior and memory after repeated tab switches.',
'Trace slow server actions and database queries. Count duplicate/N+1 queries, excessive prefetch payloads, missing filters/pagination and expensive joins; use safe staging EXPLAIN analysis.',
'Use synthetic small and realistic datasets: 2 campuses, 3 groups/campus, 50 students/group; then a larger 1,000-student dataset if time allows. Stage concurrency at 1, 10 and 25 virtual users.',
'Inspect query keys and invalidation, 60-second staleness, two-minute dashboard polling, focus/reconnect refetches and retries. Ensure caching never leaks another user or campus.',
'Profile heavy imports, tables/charts, PDF processing and Monaco loading. Add lazy loading, pagination, query/index fixes or render reductions only where traces justify them.']:check(t,size=9.5)
heading('Provisional before and after gates')
text('Warm tab response <= 500 ms; representative read-action p95 <= 1 s; primary dashboard usable <= 2.5 s under the agreed test setup. Investigate main-thread tasks > 50 ms and interaction delays > 200 ms. External mail/news/code execution gets a separate latency/error budget. These are targets, not measured results.',9.5,13)
text('Accept a speed change only if repeat measurements improve the identified bottleneck without worse errors, correctness, accessibility or authorization. Record any missed target and owner. Never trade tenant/owner checks for speed.',9.5,13)
heading('Code review applied across every module')
text('Trace UI -> action -> service -> SQL/RPC/external dependency. Inspect validation, authorization, transaction/partial-write behavior, error propagation, stale closures, concurrent updates, safe logging and secret handling. Search every caller before a shared fix; remove unused/repeated work only within the confirmed scope.',9.5,13)

start('Preparation evidence and final gates','This page is used at the start and end of the two-day run. An unchecked critical gate blocks release readiness.')
heading('Before the first test')
for t in [
'Create an isolated test/staging dataset and recovery snapshot; use fictional contacts and test mail destinations. No destructive production tests or real newsletter broadcasts.',
'Prepare Admin, Institution Admin, Teacher, Trainer, Student, Public/Mentor, shared-demo, inactive, unassigned and second-campus accounts. Test direct APIs as well as UI controls.',
'Baseline: npm test; npx tsc --noEmit; npm run lint; npm run build. Record existing failures separately. Review the 25 existing test files before adding cases; do not assume test count means coverage.',
'Review SQL fixtures in supabase/tests. Run career/newsletter SQL tests only against the isolated database. Inspect scratch scripts before any execution; they may mutate shared data.']:check(t,size=9.4)
heading('Failure to fix to proof')
text('For each failure record: case/module ID, role and tenant, input, expected/actual result, reproduction steps, severity, screenshot/log/trace, root cause, changed files/commit, automated regression, retest result and owner. Redact secrets and personal data. Keep failed/blocked/N/A distinct.',9.4,13)
heading('Release readiness')
for t in [
'All 41 module groups have a pass/fail/blocked record and evidence. Core journeys work for each role; authorization differences from the reports are resolved or explicitly tracked.',
'End-to-end: onboard -> assign teacher/course/student -> learn -> quiz/project/code -> review -> progress/analytics/attendance; student resume -> scan -> PDF; subscribed test newsletter -> suppression.',
'Rerun full automated suite and affected SQL/integration tests; types, lint and production build have no unexplained new failures. Exercise failure recovery, double submit and two-tab editing.',
'Keyboard and focus checks; mobile 375 px and desktop; refresh/deep links/back/forward; loading, empty, error and offline/reconnect states across all dashboards.',
'No open P0/P1 security, grading, data-loss or core-flow defects. Performance before/after evidence meets agreed budgets or has an explicit unresolved-item decision.',
'Reviewer signs off summary, remaining risks and deployment/rollback steps. Confirm staged fixes and migrations before any separate production release.']:check(t,size=9.4)
text('Outcome:  Pass ____   Fail ____   Blocked ____   N/A ____   Open issues ____',9.5,13,True)
text('Tester __________________  Reviewer __________________  Date __________',9.5,13)
line('Basis: current route/action/service inventory, package scripts, Vitest config and earlier 41-module access audit. Planning only; no application tests, fixes or speed improvements executed in this run.')
c.save()
r=PdfReader(str(OUT));assert len(r.pages)==10
actual=r.get_fields() or {};assert set(fields)==set(actual);assert all(str(f.get('/V','/Off'))=='/Off' for f in actual.values())
alltext='\n'.join(p.extract_text() for p in r.pages)
for i,m in enumerate(modules,1):assert m[0] in alltext,m[0]
assert len([x for x in fields if x.startswith('module_')])==41
print(f'{OUT.resolve()} | {len(r.pages)} pages | {len(fields)} interactive checkboxes | 41 modules verified')
