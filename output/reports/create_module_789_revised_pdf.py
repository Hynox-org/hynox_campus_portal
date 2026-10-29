from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT=Path('D:/hynox_campus/output/reports/Hynox-Campus-Modules-7-8-9-Report-2026-10-29-Revised.pdf')
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold','C:/Windows/Fonts/arialbd.ttf'))
navy=HexColor('#173153')
styles={
 'brand':ParagraphStyle('brand',fontName='Arial',fontSize=9,leading=12,spaceAfter=9),
 'title':ParagraphStyle('title',fontName='ArialBold',fontSize=23,leading=28,textColor=navy,spaceAfter=14),
 'sub':ParagraphStyle('sub',fontName='Arial',fontSize=10,leading=14,spaceAfter=10),
 'head':ParagraphStyle('head',fontName='ArialBold',fontSize=12,leading=15,textColor=navy,spaceBefore=7,spaceAfter=6),
 'body':ParagraphStyle('body',fontName='Arial',fontSize=9.8,leading=14,spaceAfter=5),
 'small':ParagraphStyle('small',fontName='Arial',fontSize=8.3,leading=11,spaceAfter=4),
}
story=[]
point_number=0
def p(t,style='body'):
 global point_number
 if style in ('head','title'):
  point_number=0
 if t.startswith('- '):
  point_number+=1
  t=f'{point_number}. '+t[2:]
 story.append(Paragraph(t,styles[style]))
def title(t,sub):
 p('HYNOX CAMPUS PORTAL','brand');p(t,'title');p(sub,'sub')
def block(head,issue,fix,result):
 p(head,'head');p('- Issue: '+issue);p('- Fix: '+fix);p('- Result: '+result)
def footer(c,d):
 c.setFont('Arial',8);c.setFillColor(HexColor('#506482'))
 c.drawString(43,26,'Hynox Campus | Work completion report | 29 October 2026')
 c.drawRightString(A4[0]-43,26,str(d.page))

title('Unit Testing Modules 7 to 9 Report','29 October 2026')
p('Work completed beyond unit testing','head')
for t in [
 'Corrected course completion to count eligible lessons and required assigned learning activities.',
 'Made activity creation, assignment, project submission and review transactional and scope checked.',
 'Fixed quiz scoring, answer protection, attempt limits, retake approvals and historical results.',
 'Improved bounded Supabase reads, shared progress snapshots and dashboard cache invalidation.',
 'Fixed review passing marks, quiz score denominators and a clipped activity drawer.',
 'Exercised Student, Teacher, Admin and Institution Admin workflows in native Brave.',
 'Checked selected mobile layouts and retained module-wise regression and database evidence.'
]:p('- '+t)
p('Recorded testing progress','head')
rows=[['Checkpoint','Passing tests','Test files'],['After Modules 4 to 6','468','59'],['After earlier lint cleanup','471','61'],['After Modules 7 to 9','519','70']]
t=Table(rows,colWidths=[290,105,105],hAlign='LEFT')
t.setStyle(TableStyle([('FONTNAME',(0,0),(-1,0),'ArialBold'),('FONTNAME',(0,1),(-1,-1),'Arial'),('FONTSIZE',(0,0),(-1,-1),10),('BACKGROUND',(0,0),(-1,0),navy),('TEXTCOLOR',(0,0),(-1,0),white),('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor('#EEF2F7'),white]),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]));story.append(t)
p('These are successive full-suite totals and must not be added together. The final suite contains 48 more tests than the 471-test checkpoint.','small')
p('Verification results','head')
p('- Passed: 519 tests across 70 files, production build, TypeScript and focused lint across 134 files with zero errors or warnings.')
p('- Passed: rolled-back synthetic Supabase fixtures and selected four-role browser journeys. Project layouts were inspected at 320, 375 and 768 pixels.')

story.append(PageBreak())
title('Module 7 Learning progress','29 October | Lesson completion, required activities and course percentages')
block('Accurate completion rules',
 'The calculation could assume one enrollment, include optional or ineligible work and show a lesson-only percentage.',
 'Shared authoritative snapshots now count eligible lessons and required activities assigned to the Student for that course. Duplicate assignments and attempts do not add extra units.',
 'Quizzes count only when passed, projects when approved and coding work when accepted. Draft, archived, deleted and inaccessible work is excluded. Optional work does not block 100 percent.')
block('Reliable state and error handling',
 'Stored totals could become stale, evidence read errors could be suppressed and repeated updates could reset the start timestamp.',
 'Used atomic lesson completion and validated snapshot responses. Kept errors explicit, preserved start state and required exact completed counts before marking a course complete.',
 'An incomplete course cannot round up to 100 percent. Empty courses remain at zero, and an activity does not silently complete its parent lesson.')
block('Fewer repeated database reads',
 'Delivery and staff summaries needed consistent totals without repeated unbounded reads or progress writes during page loading.',
 'Deduplicated snapshot requests, bounded batches to 50 Students and 100 courses, and allowed at most four independent RPCs in parallel.',
 'Normal Student delivery uses four table reads and one snapshot RPC. Student displays and staff averages share the calculation rules; read paths do not write progress.')
p('Manual completion journey','head')
p('- A retained QA course contained one lesson, one required quiz, one required project and two optional activities.')
p('- Completing the lesson showed 33.33 percent. Project approval increased it to 66.67 percent. Passing the quiz produced 100 percent, 1/1 lessons and 2/2 required activities.')
p('- Both optional activities remained unfinished. Institution Admin showed 50 percent average progress across the QA cohort\'s two courses, including the other course at zero.')
p('Verification','head')
p('- Unit, component and service regressions passed. Synthetic integration transactions covered eligibility, multiple enrollments, duplicates, exact completion and guarded access, then rolled back.')
p('Evidence: output/testing/module-07/report.md, database-integration.sql and the shared Module 9 final validation logs.','small')

story.append(PageBreak())
title('Module 8 Activity management','29 October | Activity editing, assignments, projects and learning delivery')
block('Atomic saves and assignment checks',
 'Separate activity, subtype, question and assignment requests could leave partial records after failure. Role and campus checks were inconsistent.',
 'Moved related writes into validated database transactions. Added current-user, parent, campus and cohort-mapping checks, plus idempotent assignment retries.',
 'A standalone assigned Teacher can manage mapped activities. Unauthorized and unrelated campus operations are rejected; retries do not duplicate assignments.')
block('Project submission and review',
 'Student project creation and review paths needed stronger assignment checks and reliable completion state.',
 'Accepted only assigned persisted projects and guarded submission and review transactions. Prevented Students from approving work or awarding their own grade.',
 'Student submitted a synthetic repository URL and notes. Teacher approved 90/100. Student then saw Approved, the score, exact mentor feedback and a locked submission form.')
block('Review marks and drawer usability',
 'Staff submission queries omitted the passing score, showing 50 instead of configured 60. An animated ancestor clipped the activity console header.',
 'Returned the stored threshold in both shared projections and rendered the drawer at the document root with an accessible close button.',
 'Two passing-mark regressions and a drawer regression passed. Brave retests showed 60 and the complete drawer header and close control.')
p('Manual publication and responsive checks','head')
p('- Teacher created an optional project, saved a draft, published it to the QA cohort and edited its title. Student saw the updated project.')
p('- Empty submission input produced visible feedback. Malformed input created no submission.')
p('- Student project overview and form were inspected at 320, 375 and 768 pixels. Text wrapped and primary controls remained available. Mobile navigation and quiz cards were checked at 375 pixels.')
p('Caching and coding safeguards','head')
p('- Learning writes participate in protected delivery revision updates and cache invalidation. New course and activity data appeared without a full page reload.')
p('- Coding submission and worker code received assignment, credential and job-claim safeguards.')
p('- Synthetic integration fixtures were rolled back; manual QA data was retained.')
p('Evidence: output/testing/module-08/report.md, database-integration.sql, before/after regression logs and Module 9 manual-verification.md.','small')

story.append(PageBreak())
title('Module 9 Quizzes','29 October | Questions, attempts, scoring, results and retake approvals')
block('Protected questions and reliable attempts',
 'Student responses exposed answer keys. Attempt allocation trusted supplied context and could race or select the wrong assignment.',
 'Added safe question projections and restricted raw answer writes. Start now derives assignment eligibility on the server and locks attempt allocation; active-attempt retries reuse the session.',
 'Students cannot read correct-option keys through the protected projection. Invalid ownership and unauthorized operations are rejected. Attempted question edits cannot corrupt grading history.')
block('Accurate grading and score displays',
 'Question points and configured activity scores used different scales. Some staff summaries inferred pass/fail incorrectly, and Admin displayed 8/100 for an eight-point quiz.',
 'Normalized grading against the configured threshold, required exact multiple-choice selections and normalized short-answer case and whitespace. Used stored verdicts and actual question totals in result displays.',
 'All four formats were exercised in Brave. A blank attempt failed at 0/8; the correct retake passed at 8/8. Admin retesting also displayed Completed and 8/8. Regression coverage was added.')
block('Retake approval without losing history',
 'Approval changed counters without reliably granting another attempt. Ordinary failed attempts lacked the Teacher approval button, and the Student label ignored approved allowance.',
 'Recorded one extra allowance per closed unsuccessful attempt, preserved attempt history and made the approval control available for ordinary failures. Counter and Start eligibility use the same allowance.',
 'Teacher approved one retake; a database read confirmed exactly one credit. Student completed attempt 2, saw 2/2 and could not start another attempt after passing.')
p('Verification and useful evidence','head')
p('- Final automated suite: 519 tests in 70 files. Production build, TypeScript, focused lint and diff checks passed. Database integration fixtures were rolled back.')
p('- One parallel verification run recorded six UI timing failures while build and type checking were also running. The log was retained; the later full run passed all 519 tests.')
p('- Institution Admin\'s QA cohort filter showed one Student, 50 percent quiz pass rate across one failed and one passed attempt, and 100 percent project approval.')
p('Evidence: output/testing/module-09/report.md, manual-verification.md, database-integration.sql, live-qa-manifest.json, tests-final.log, build-final.log, types-final.log and lint-final.json.','small')

SimpleDocTemplate(str(OUT),pagesize=A4,leftMargin=49,rightMargin=43,topMargin=42,bottomMargin=46).build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
