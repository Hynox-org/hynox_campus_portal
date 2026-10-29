const fs=require('fs'),p='src/services/delivery.ts';let s=fs.readFileSync(p,'utf8');
for (const [functionName, rows, cohortFilter, next] of [
 ['listEnrollments','filtered','.in("cohort_id", [...new Set(filtered.map(enrollment => enrollment.cohort_id))])','  const progressRecords'],
 ['listCohortEnrollments','enrollments','.eq("cohort_id", cohortId)','  const courseIds']
]) {
 const fn=s.indexOf('export async function '+functionName+'('),a=s.indexOf('  let students: CampusUser[] = [];',fn),b=s.indexOf(next,a);
 if(fn<0||a<0||b<0)throw Error('Missing enrollment boundary: '+functionName);
 const replacement=`  const [userResult, assignmentResult] = await Promise.all([
    supabase.schema("core").from("users").select("id, full_name, email").in("id", studentIds),
    supabase.schema("delivery").from("course_assignments").select("*")${cohortFilter}.is("deleted_at", null),
  ]);
  if (userResult.error) throw userResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  const students: CampusUser[] = userResult.data || [];
  const assignments = assignmentResult.data || [];

`;
 s=s.slice(0,a)+replacement+s.slice(b);
}
s=s.replace('import type { Row } from "@/types/database-rows";\n','');fs.writeFileSync(p,s);
