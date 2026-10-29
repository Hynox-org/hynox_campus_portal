const fs=require('fs'),ts=require('typescript');
const files=JSON.parse(fs.readFileSync('output/testing/lint-cleanup/before.json','utf8')).map(x=>x.filePath);
const named={institutions:'Institution[]',assignedInstitutions:'Institution[]',institution:'Institution',initialPrograms:'Program[]',programs:'Program[]',programsList:'Program[]',program:'Program',initialCourses:'Course[]',courses:'Course[]',coursesList:'Course[]',tenantCourses:'Course[]',course:'Course',initialModules:'Module[]',modules:'Module[]',syllabusModules:'Module[]',modulesCache:'Record<string, Module[]>',lessonsCache:'Record<string, Lesson[]>',resourcesCache:'Record<string, Resource[]>',moduleLessons:'Record<string, Lesson[]>',lessonResources:'Record<string, Resource[]>',drawerLessonsCache:'Record<string, Lesson[]>',initialInstructors:'CampusUser[]',tenantInstructors:'CampusUser[]',instructors:'CampusUser[]',courseTypes:'Lookup[]',lessonTypes:'Lookup[]',statuses:'Lookup[]',visibilityTypes:'Lookup[]',lessonStatuses:'Lookup[]',cohortStatuses:'Lookup[]',enrollmentStatuses:'Lookup[]',initialCohorts:'Cohort[]',cohorts:'Cohort[]',enrollments:'Enrollment[]',invitations:'Invitation[]',selectedInstForSidebar:'Institution | null',instToDelete:'Institution | null',selectedUserDetail:'CampusUser | null',explorerUsers:'CampusUser[]',selectedTeacherForDetail:'CampusUser | null',progSelectedProgram:'Program | null',acadSelectedProgram:'Program | null',acadSelectedCourse:'Course | null',editingProgram:'Program | null',selectedProgram:'Program | null',editingCourse:'Course | null',selectedCourse:'Course | null',editingModule:'Module | null',editingLesson:'Lesson | null',selectedLesson:'Lesson | null',activeLesson:'Lesson | null',lessonsList:'Lesson[]',syllabusLessons:'Lesson[]',selectedCohort:'Cohort | null',editingCohort:'Cohort | null',selectedStudent:'Enrollment | null',activeStudentProgress:'Program[]',activeStudentLessonsProgress:'LessonProgress[]',lessonProgressMap:'Record<string, LessonProgress>',cohortReports:'Record<string, CohortReport>',activities:'Activity[]',selectedActivity:'Activity | null',selectedQuizActivity:'Activity | null',selectedProjectActivity:'Activity | null',selectedChallengeActivity:'Activity | null',quizDetails:'Quiz | null',quizQuestions:'QuizQuestion[]',quizQuestionsList:'QuizQuestion[]',activeAttempt:'QuizAttempt | null',quizSubmittedResult:'QuizAttempt | null',selectedQuizAttempt:'QuizAttempt | null',activeAttemptRef:'QuizAttempt | null',projectDetails:'Project | null',lessonProjectDetails:'Project | null',projectSubmission:'ProjectSubmission | null',lessonProjectSubmission:'ProjectSubmission | null',selectedProjectSub:'ProjectSubmission | null',projectReview:'ProjectReview | null',lessonProjectReview:'ProjectReview | null',challengeDetails:'Challenge | null',challengeExamples:'ChallengeExample[]',examplesList:'ChallengeExample[]',challengeSubmissions:'ChallengeSubmission[]',selectedChallengeSub:'ChallengeSubmission | null',selectedSubmissionForResults:'ChallengeSubmission | null',testCasesList:'Row<"learning.challenge_test_cases">[]',attendanceLogs:'Row<"delivery.attendance_records">[]',activityDetails:'ActivityDetails | null',quizAttemptSession:'QuizSession | null',submissionResults:'ChallengeResults | null'};
const params={inst:'Institution',teacher:'CampusUser',cohort:'Cohort',enr:'Enrollment',lesson:'Lesson',module:'Module',course:'Course',activity:'Activity',program:'Program',submission:'ProjectSubmission | null',review:'ProjectReview | null',freshActivities:'Activity[] | undefined'};
const types=new Set(Object.values(named).concat(Object.values(params)).join(' ').match(/\b[A-Z]\w+/g));
for(const f of files){
 let s=fs.readFileSync(f,'utf8');
 // Directives must precede imports.
 s=s.replace(/^import \{ errorMessage \} from "@\/lib\/error-message";\n(\s*["']use (?:client|server)["'];)/,'$1\nimport { errorMessage } from "@/lib/error-message";');
 s=s.replace(/result\.errorMessage\(error\)/g,'errorMessage(result.error)');
 const sf=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[];
 const imported=new Set();
 function replace(n,t){edits.push([n.getStart(sf),n.end,t]);for(const x of t.match(/\b[A-Z]\w+/g)||[])if(types.has(x)&&!['Record','Partial'].includes(x))imported.add(x);}
 function visit(n){
   if(ts.isTypeNode(n)&&/\bany\b/.test(n.getText(sf))){
     let name;
     if(ts.isPropertySignature(n.parent))name=n.parent.name.getText(sf);
     if(ts.isCallExpression(n.parent)&&['useState','useRef'].includes(n.parent.expression.getText(sf))){const d=n.parent.parent; if(ts.isVariableDeclaration(d))name=ts.isArrayBindingPattern(d.name)?d.name.elements[0].name.getText(sf):d.name.getText(sf);}
     if(name&&named[name]){
       let t=named[name];
       if(f.endsWith('library-builder.tsx'))t=t.replace(/\bCourse\b/g,'CourseTemplate').replace(/\bModule\b/g,'ModuleTemplate').replace(/\bLesson\b/g,'LessonTemplate').replace(/\bResource\b/g,'ResourceTemplate');
       replace(n,t);return;
     }
     if(ts.isParameter(n.parent)&&params[n.parent.name.getText(sf)]){replace(n,params[n.parent.name.getText(sf)]);return;}
   }ts.forEachChild(n,visit);
 }visit(sf);
 for(const[a,b,v]of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+v+s.slice(b);
 if(imported.size){const imp=`import type { ${[...imported].filter(x=>x!=='Row').join(', ')} } from "@/types/campus";\n`+(imported.has('Row')?'import type { Row } from "@/types/database-rows";\n':''); const directive=s.match(/^\s*["']use (?:client|server)["'];\s*/);const pos=directive?directive[0].length:0;s=s.slice(0,pos)+imp+s.slice(pos);}
 fs.writeFileSync(f,s);
}
