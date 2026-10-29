const fs=require('fs'),ts=require('typescript');function edit(f,fn){const p='src/'+f;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
edit('types/campus.ts',s=>s.replace('export type CohortReport = { students: Array<{ user_id: string; progress_percentage: number; completed_lessons?: number; total_lessons?: number }>; [key: string]: unknown };','export type CohortReport = import("@/services/attendance").AttendanceStats;'));
edit('app/institution/analytics-tab.tsx',s=>s.replace('import type { ProjectSubmission, ChallengeSubmission } from "@/types/campus";\n"use client";','"use client";\nimport type { ProjectSubmission, QuizAttempt } from "@/types/campus";').replace('quizAttempts: any[]','quizAttempts: QuizAttempt[]'));
edit('app/academic/[programSlug]/[courseSlug]/course-space-console.tsx',s=>s.replace('setModuleStatusId(mod.status_id)','setModuleStatusId(mod.status_id || "")').replace('    if (!confirm(`Delete lesson','    if (!less.module_id) return;\n    const moduleId = less.module_id;\n    if (!confirm(`Delete lesson').replace('[less.module_id]: prev[less.module_id].filter','[moduleId]: (prev[moduleId] || []).filter'));
edit('app/teacher/teacher-console.tsx',s=>s.replaceAll('selectedProjectSub.max_score * 0.5','(selectedProjectSub.max_score ?? 100) * 0.5').replaceAll('hasRestoredFromUrl.current = true','setRestoredFromUrl(true)'));
edit('app/student/student-console.tsx',s=>{
 s=s.replaceAll('hasRestoredLesson.current = true','setRestoredLesson(true)');
 // A cohort switch is an event. Its ref changes never run while rendering.
 s=s.replace('const handleSelectCohort = (cohort: Cohort) => {','const handleSelectCohort = useCallback((cohort: Cohort) => {').replace('    setSubmissionResults(null);\n  };\n\n  const handleSelectCourse','    setSubmissionResults(null);\n  }, []);\n\n  const handleSelectCourse');
 // The initial refresh calls loadLessonProgress, so define the effect after it.
 const start=s.indexOf('  const refreshFromEffect =');const end=s.indexOf('  const loadLessonProgress',start);const block=s.slice(start,end);s=s.slice(0,start)+s.slice(end);const insertion=s.indexOf('  const handleSelectCohort');s=s.slice(0,insertion)+block+s.slice(insertion);
 // Event callbacks read the latest state without restarting browser subscriptions.
 const marker='  // Grace-period countdown:';let i=s.indexOf(marker);s=s.slice(0,i)+'  const forfeitFromEffect = useEffectEvent(forfeitAttempt);\n  const violationFromEffect = useEffectEvent(registerViolation);\n  const resyncFromEffect = useEffectEvent(resyncSelectedQuizActivity);\n'+s.slice(i);
 const sf=ts.createSourceFile('student.tsx',s,99,true,4),edits=[];
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'){
   const dep=n.arguments[1]?.getText(sf);if(dep==='[quizViolationWarning]'||dep==='[activeAttempt, quizDetails]'){
    const body=n.arguments[0].getText(sf).replace(/\bforfeitAttempt\(/g,'forfeitFromEffect(').replace(/\bregisterViolation\(/g,'violationFromEffect(').replace(/\bresyncSelectedQuizActivity\(/g,'resyncFromEffect(').replace(/\brefreshStudentData\(/g,'refreshFromEffect(');
    edits.push([n.arguments[0].getStart(sf),n.arguments[0].end,body]);if(body.includes('showError')||body.includes('showSuccess'))edits.push([n.arguments[1].getStart(sf),n.arguments[1].end,'[activeAttempt, quizDetails, showError, showSuccess]']);
   }
 }ts.forEachChild(n,visit);}visit(sf);for(const[a,b,t]of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+t+s.slice(b);return s;
});
