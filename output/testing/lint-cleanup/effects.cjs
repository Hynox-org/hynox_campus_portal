const fs=require('fs'),ts=require('typescript');
const plan={
 'app/admin/admin-panel.tsx':['[adminData]'],
 'app/admin/delivery-manager.tsx':['[initialTab]'],
 'app/institution/institution-panel.tsx':['[initialCohorts, selectedCohortId]'],
 'app/student/student-console.tsx':['[initialPrograms, hasDeliveryData]','[initialPrograms, hasDeliveryData, selectedCourse, selectedCohort?.id]','[academicPrefetch, selectedCourse?.id]'],
 'app/teacher/teacher-console.tsx':['[assignedCohorts, assignedInstitutions, selectedCohort, selectedCohortId, selectedInstId]','[academicPrefetch]','[academicPrefetch, syllabusCourseId, syllabusModuleId, syllabusLessonId]','[syllabusLessonId, syllabusLessons, syllabusViewMode]','[selectedProjectSub]']
};
for(const[f,deps]of Object.entries(plan)){
 let p='src/'+f,s=fs.readFileSync(p,'utf8'),sf=ts.createSourceFile(p,s,99,true,4),edits=[];
 function visit(n){
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&deps.includes(n.arguments[1]?.getText(sf))){const b=n.arguments[0].body;edits.push([n.parent.getStart(sf),n.parent.end,`if (useInputsChanged(${n.arguments[1].getText(sf)})) {\n    (() => ${b.getText(sf)})();\n  }`]);}
  ts.forEachChild(n,visit);
 }visit(sf);for(const[a,b,t]of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+t+s.slice(b);
 const d=s.match(/^\s*"use client";\s*/);let i=d?d[0].length:0;s=s.slice(0,i)+'import { useInputsChanged, useHydrated } from "@/hooks/use-inputs-changed";\n'+s.slice(i);
 // URL restoration happens once hydration has completed, without a cascading effect.
 sf=ts.createSourceFile(p,s,99,true,4);let nav;
 function find(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[1]?.getText(sf)==='[]'&&n.arguments[0].getText(sf).includes('params.get("tab")'))nav=n;ts.forEachChild(n,find);}find(sf);
 if(nav){const b=nav.arguments[0].body.getText(sf);s=s.slice(0,nav.parent.getStart(sf))+`const hydrated = useHydrated();\n  if (useInputsChanged([hydrated]) && hydrated) {\n    (() => ${b})();\n  }`+s.slice(nav.parent.end);}
 fs.writeFileSync(p,s);
}
