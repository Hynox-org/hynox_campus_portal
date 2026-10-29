const fs=require('fs'),ts=require('typescript');function edit(f,fn){const p='src/'+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
edit('app/admin/program-manager.tsx',s=>s.replace('useState, useEffect','useState, useEffect, useCallback').replace('const handleSelectCourse = async (courseId: string) => {','const handleSelectCourse = useCallback(async (courseId: string) => {').replace('  // Auto-select the first course', '  // Auto-select the first course').replace('  };\n\n  // Auto-select','  }, [modulesCache, modulesLoading, queryClient, showError]);\n\n  // Auto-select'));
edit('app/teacher/teacher-console.tsx',s=>s.replace('selectedProjectSub.max_score * 0.5','(selectedProjectSub.max_score ?? 100) * 0.5').replace('hasRestoredFromUrl.current = true','setRestoredFromUrl(true)').replace('(value: any)','(value: string)'));
edit('app/institution/institution-panel.tsx',s=>s.replace('const reports: Record<string, any>','const reports: Record<string, CohortReport>'));
edit('app/institution/analytics-tab.tsx',s=>'import type { ProjectSubmission, ChallengeSubmission } from "@/types/campus";\n'+s.replace('projectSubmissions: any[]','projectSubmissions: ProjectSubmission[]').replace('challengeSubmissions: any[]','challengeSubmissions: ChallengeSubmission[]'));
edit('app/academic/[programSlug]/[courseSlug]/course-space-console.tsx',s=>s.replace('useState<any | null>','useState<Module | null>').replace('less: any','less: Lesson').replace('mod: any','mod: Module'));
edit('app/student/student-console.tsx',s=>{
 s=s.replace('useRef, useCallback','useRef, useCallback, useEffectEvent');
 s=s.replace('const hasRestoredLesson = useRef(false);','const [restoredLesson, setRestoredLesson] = useState(false);').replace('hasRestoredLesson.current = true','setRestoredLesson(true)').replace('hasRestoredLesson.current','restoredLesson');
 s=s.replace('const [timeLeft, setTimeLeft] = useState<number | null>(null);','const [timerNow, setTimerNow] = useState(() => Date.now());\n  const timeLeft = activeAttempt && quizDetails?.time_limit_minutes ? Math.max(0, Math.ceil((Date.parse(activeAttempt.started_at) + quizDetails.time_limit_minutes * 60000 - timerNow) / 1000)) : null;');
 s=s.replace('      setTimeLeft(null);\n','').replace('    setTimeLeft(calculateTimeLeft());\n','').replace('      setTimeLeft(remaining);','      setTimerNow(Date.now());');
 s=s.replace('quizViolationWarning.deadline - Date.now()','quizViolationWarning.deadline - timerNow');
 s=s.replace('[selectedCohort, studentId]);','[selectedCohort, studentId, showError]);');
 // Move the mount request below its declaration and call the latest closure
 // without resubscribing whenever the selected course changes.
 const sf=ts.createSourceFile('student.tsx',s,99,true,4);let mount,refresh,restore,lesson;
 function visit(n){
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'){
   const dep=n.arguments[1]?.getText(sf),body=n.arguments[0].body;
   if(dep==='[studentId]')mount=n;
   if(dep==='[selectedCohort, selectedCourse, initialSelection.course, handleSelectCourse]')restore=n;
   if(dep==='[modules, activeLesson, initialSelection.lesson]')lesson=n;
  }
  if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='refreshStudentData')refresh=n.parent.parent;
  ts.forEachChild(n,visit);
 }visit(sf);
 const edits=[];
 if(mount&&refresh){edits.push([mount.parent.getStart(sf),mount.parent.end,'']);edits.push([refresh.end,refresh.end,'\n  const refreshFromEffect = useEffectEvent(refreshStudentData);\n  useEffect(() => { void refreshFromEffect(); }, [studentId]);\n']);}
 if(restore){let body=restore.arguments[0].body.getText(sf).slice(1,-1);body=body.replace('void handleSelectCourse(selectedCohort.courses[idx]);\n          hasRestoredCourse.current = true;','hasRestoredCourse.current = true;\n          await handleSelectCourse(selectedCohort.courses[idx]);');edits.push([restore.arguments[0].getStart(sf),restore.arguments[0].end,`() => { async function restoreCourse() {${body}} void restoreCourse(); }`]);}
 if(lesson){edits.push([lesson.parent.getStart(sf),lesson.parent.end,`if (useInputsChanged([modules, activeLesson, initialSelection.lesson])) { (() => ${lesson.arguments[0].body.getText(sf)})(); }`]);}
 for(const[a,b,t]of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+t+s.slice(b);
 // The menu data is pure. Keep its event handlers out of an invoked render helper.
 const sf2=ts.createSourceFile('student.tsx',s,99,true,4);let menu;
 function find(n){if(ts.isJsxExpression(n)&&n.expression&&ts.isCallExpression(n.expression)&&n.getText(sf2).includes('const flatCohorts: Cohort[]'))menu=n;ts.forEachChild(n,find);}find(sf2);
 if(menu){const fn=menu.expression.expression.expression||menu.expression.expression;const body=fn.body;const stmts=body.statements;const ifnode=stmts.find(n=>ts.isIfStatement(n));const fallback=stmts[stmts.length-1].expression;const success=ifnode.thenStatement.statements[0].expression;const pre=stmts.slice(0,stmts.indexOf(ifnode)).map(n=>n.getText(sf2)).join('\n');s=s.slice(0,menu.getStart(sf2))+`{flatCohorts.length > 0 ? ${success.getText(sf2)} : ${fallback.getText(sf2)}}`+s.slice(menu.end);const pos=s.indexOf('  if (studentDeliveryError)');s=s.slice(0,pos)+pre+'\n'+s.slice(pos);}
 return s;
});
