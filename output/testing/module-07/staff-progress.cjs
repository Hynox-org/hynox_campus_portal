const fs=require('fs');let p='src/services/delivery.ts',s=fs.readFileSync(p,'utf8');
let a=s.indexOf('  let progressRecords: Row<"delivery.course_progress">[] = [];'),b=s.indexOf('  return filtered.map',a);
if(a<0||b<0)throw Error('Missing enrollment progress boundaries');
s=s.slice(0,a)+'  const progressRecords = await readProgressSnapshots(studentIds, assignments.map(assignment => assignment.course_id), supabase);\n\n'+s.slice(b);
a=s.indexOf('  let progresses: Row<"delivery.course_progress">[] = [];');b=s.indexOf('  return enrollments.map',a);
if(a<0||b<0)throw Error('Missing cohort progress boundaries');
s=s.slice(0,a)+'  const progresses = await readProgressSnapshots(studentIds, courseIds, supabase);\n\n'+s.slice(b);
fs.writeFileSync(p,s);
