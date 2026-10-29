const fs=require('fs'); const p='src/services/delivery.ts'; let s=fs.readFileSync(p,'utf8');
const start=s.indexOf('export async function syncCourseProgress(userId: string, courseId: string) {');
const end=s.indexOf('export async function listStudentLessonProgress',start);
if(start<0||end<0)throw Error('Missing progress boundaries');
s=s.slice(0,start)+'export async function syncCourseProgress(userId: string, courseId: string) {\n  await requireStudentRead(userId);\n  return refreshProgressSnapshot(userId, courseId);\n}\n\n'+s.slice(end);
const activity=s.indexOf('export async function syncCourseProgressByActivity(');
if(activity<0)throw Error('Missing activity synchronization');
s=s.slice(0,activity)+`export async function syncCourseProgressByActivity(userId: string, activityId: string) {
  await requireStudentRead(userId);
  const supabase = await createClient();
  const { data: activity, error } = await supabase.schema("learning").from("activities").select("lesson_id").eq("id", activityId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!activity?.lesson_id) return;
  const scope = await academicScope("lessons", activity.lesson_id);
  if (scope.courseId) await syncCourseProgress(userId, scope.courseId);
}
`;
s='import { readProgressSnapshots, refreshProgressSnapshot } from "./course-progress";\n'+s;
s=s.replace('supabase.schema("delivery").from("course_progress").select("*").eq("user_id", userId).in("course_id", courseIds),','readProgressSnapshots([userId], courseIds, supabase).then(data => ({ data, error: null })),');
fs.writeFileSync(p,s);
