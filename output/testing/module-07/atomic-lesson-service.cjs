const fs=require('fs'),p='src/services/delivery.ts';let s=fs.readFileSync(p,'utf8');const start=s.indexOf('export async function startOrUpdateLessonProgress('),end=s.indexOf('export async function syncCourseProgress(userId:',start);if(start<0||end<0)throw Error('Missing lesson functions');s=s.slice(0,start)+`export async function startOrUpdateLessonProgress(userId: string, lessonId: string, courseId: string) {
  const caller = await requireStudentRead(userId);
  if (caller.primaryRole !== "student" || caller.user.id !== userId) throw new Error("Only the student may update their lesson progress.");
  validateInstitutionId(lessonId); validateInstitutionId(courseId);
  return setLessonProgress(userId, lessonId, courseId, false);
}

export async function completeLessonProgress(userId: string, lessonId: string, courseId: string) {
  const caller = await requireStudentRead(userId);
  if (caller.primaryRole !== "student" || caller.user.id !== userId) throw new Error("Only the student may update their lesson progress.");
  validateInstitutionId(lessonId); validateInstitutionId(courseId);
  return setLessonProgress(userId, lessonId, courseId, true);
}

`+s.slice(end);s=s.replace('readProgressSnapshots, refreshProgressSnapshot','readProgressSnapshots, refreshProgressSnapshot, setLessonProgress');fs.writeFileSync(p,s);
