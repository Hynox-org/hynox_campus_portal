import { createClient } from "@/utils/supabase/server";
import { validateInstitutionId } from "@/lib/institution-validation";
import { summarizeAttendance, validateAttendanceDate } from "@/lib/attendance";

export type AttendanceStatus = "present" | "absent" | "late";
export interface AttendanceStudent { id: string; full_name: string; email: string; enrolled_date?: string }
export interface AttendanceDateInfo { date: string; isSunday: boolean; isHoliday: boolean; holidayName: string | null; sessionId: string | null }
export interface AttendanceRegister {
  cohort: { id: string; name: string; code: string; start_date: string; end_date: string };
  students: AttendanceStudent[]; dates: AttendanceDateInfo[];
  records: Record<string, Record<string, AttendanceStatus>>;
}
export interface StudentAttendanceStats { studentId: string; name: string; email: string; present: number; absent: number; late: number; workingDays: number; percentage: number }
export interface AttendanceStats { workingDays: number; holidays: number; totalDays: number; students: StudentAttendanceStats[] }

async function attendanceRpc(name: string, input: Record<string, unknown>) {
  const db = await createClient();
  const { data, error } = await db.schema("delivery").rpc(name, input);
  if (error) throw error;
  return data;
}
export async function verifyAttendanceMarkingPermission(cohortId: string, userId: string, userRole: string) {
  validateInstitutionId(cohortId); validateInstitutionId(userId);
  if (!["super_admin", "teacher", "trainer"].includes(userRole)) return false;
  // Actor identity and role are checked again inside the database.
  return (await attendanceRpc("can_mark_attendance", { p_cohort: cohortId, p_actor: userId })) === true;
}
export async function getCohortAttendanceRegister(cohortId: string, studentId?: string): Promise<AttendanceRegister> {
  validateInstitutionId(cohortId);
  if (studentId) validateInstitutionId(studentId);
  const data = await attendanceRpc("attendance_register", { p_cohort: cohortId, p_student: studentId ?? null });
  if (!data?.cohort || !Array.isArray(data.students) || !Array.isArray(data.dates) || !data.records) throw new Error("Attendance register was not confirmed.");
  return data;
}
export async function setHoliday(cohortId: string, date: string, holiday: boolean, name: string | undefined, markedBy: string) {
  validateInstitutionId(cohortId); validateInstitutionId(markedBy); validateAttendanceDate(date);
  if (typeof holiday !== "boolean" || (name !== undefined && (typeof name !== "string" || name.trim().length > 160))) throw new Error("Invalid holiday details.");
  await attendanceRpc("save_attendance", { p_cohort: cohortId, p_date: date, p_records: null, p_holiday: holiday, p_name: name?.trim() || null });
}
export async function saveAttendanceForDate(cohortId: string, date: string, records: { student_id: string; status: AttendanceStatus }[], markedBy: string) {
  validateInstitutionId(cohortId); validateInstitutionId(markedBy); validateAttendanceDate(date);
  if (!Array.isArray(records) || !records.length || records.length > 2500) throw new Error("Provide between 1 and 2500 attendance records.");
  const ids = new Set<string>();
  for (const row of records) {
    if (!row || !["present", "absent", "late"].includes(row.status)) throw new Error("Invalid attendance status.");
    validateInstitutionId(row.student_id);
    if (ids.has(row.student_id)) throw new Error("Duplicate student attendance.");
    ids.add(row.student_id);
  }
  await attendanceRpc("save_attendance", { p_cohort: cohortId, p_date: date, p_records: records, p_holiday: null, p_name: null });
}
export async function setAttendanceStatus(cohortId: string, date: string, studentId: string, status: AttendanceStatus, markedBy: string) {
  await saveAttendanceForDate(cohortId, date, [{ student_id: studentId, status }], markedBy);
}
export async function getCohortAttendanceStats(cohortId: string) { return summarizeAttendance(await getCohortAttendanceRegister(cohortId)); }
export async function getStudentAttendanceSummary(cohortId: string, studentId: string) {
  return summarizeAttendance(await getCohortAttendanceRegister(cohortId, studentId)).students.find(s => s.studentId === studentId) ?? null;
}
