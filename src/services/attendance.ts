import { createClient } from "@/utils/supabase/server";

export type AttendanceStatus = "present" | "absent" | "late";

export interface AttendanceStudent {
  id: string;
  full_name: string;
  email: string;
}

export interface AttendanceDateInfo {
  date: string;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  sessionId: string | null;
}

export interface AttendanceRegister {
  cohort: { id: string; name: string; code: string; start_date: string; end_date: string };
  students: AttendanceStudent[];
  dates: AttendanceDateInfo[];
  records: Record<string, Record<string, AttendanceStatus>>; // studentId -> date -> status
}

function toDateStr(d: Date) {
  return d.toISOString().substring(0, 10);
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate.substring(0, 10) + "T00:00:00Z");
  const end = new Date(endDate.substring(0, 10) + "T00:00:00Z");
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(toDateStr(d));
  }
  return dates;
}

// Check if a user is a Super Admin, or a Teacher assigned to the cohort
export async function verifyAttendanceMarkingPermission(cohortId: string, userId: string, userRole: string) {
  if (userRole === "super_admin") return true;
  if (userRole !== "teacher" && userRole !== "trainer") return false;

  const supabase = await createClient();

  const { data: assignment, error } = await supabase
    .schema("delivery")
    .from("cohort_teachers")
    .select("id")
    .eq("cohort_id", cohortId)
    .eq("teacher_id", userId)
    .maybeSingle();

  if (!error && assignment) return true;

  // Fallback: teacher belongs to the cohort's institution
  const { data: cohort, error: cohortError } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("institution_id")
    .eq("id", cohortId)
    .single();

  if (cohortError || !cohort) return false;

  const { data: teacher, error: teacherError } = await supabase
    .schema("core")
    .from("users")
    .select("tenant_id, institution_id")
    .eq("id", userId)
    .single();

  if (teacherError || !teacher) return false;

  return teacher.institution_id === cohort.institution_id || teacher.tenant_id === cohort.institution_id;
}

// Fetch the full register for a cohort: roster, dates, holidays, and existing records
export async function getCohortAttendanceRegister(cohortId: string): Promise<AttendanceRegister> {
  const supabase = await createClient();

  const { data: cohort, error: cohortError } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("id, name, code, start_date, end_date")
    .eq("id", cohortId)
    .single();

  if (cohortError || !cohort) throw new Error("Cohort not found.");
  if (!cohort.start_date || !cohort.end_date) {
    throw new Error("This group does not have a start and end date configured.");
  }

  const { data: enrollments } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null);

  const studentIds = (enrollments || []).map((e) => e.user_id);

  let students: AttendanceStudent[] = [];
  if (studentIds.length > 0) {
    const { data: userData } = await supabase
      .schema("core")
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);
    students = (userData || [])
      .map((u) => ({ id: u.id, full_name: u.full_name || u.email || "Student", email: u.email }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  const { data: sessions } = await supabase
    .schema("delivery")
    .from("attendance_sessions")
    .select("id, session_date, is_holiday, holiday_name")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null);

  const sessionByDate = new Map((sessions || []).map((s) => [s.session_date.substring(0, 10), s]));

  const rangeDates = buildDateRange(cohort.start_date, cohort.end_date);
  const dates: AttendanceDateInfo[] = rangeDates.map((dateStr) => {
    const session = sessionByDate.get(dateStr);
    const isSunday = new Date(dateStr + "T00:00:00Z").getUTCDay() === 0;
    return {
      date: dateStr,
      isSunday,
      isHoliday: session ? session.is_holiday : isSunday,
      holidayName: session?.holiday_name || (isSunday && !session ? "Sunday" : null),
      sessionId: session?.id || null,
    };
  });

  const sessionIds = (sessions || []).map((s) => s.id);
  const records: Record<string, Record<string, AttendanceStatus>> = {};
  if (sessionIds.length > 0) {
    const { data: recordData } = await supabase
      .schema("delivery")
      .from("attendance_records")
      .select("student_id, status, session_id")
      .in("session_id", sessionIds)
      .is("deleted_at", null);

    const sessionIdToDate = new Map((sessions || []).map((s) => [s.id, s.session_date.substring(0, 10)]));

    for (const record of recordData || []) {
      const dateStr = sessionIdToDate.get(record.session_id);
      if (!dateStr) continue;
      if (!records[record.student_id]) records[record.student_id] = {};
      records[record.student_id][dateStr] = record.status as AttendanceStatus;
    }
  }

  return {
    cohort: cohort as AttendanceRegister["cohort"],
    students,
    dates,
    records,
  };
}

async function findOrCreateSession(cohortId: string, dateStr: string, markedBy: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .schema("delivery")
    .from("attendance_sessions")
    .select("id, is_holiday, holiday_name")
    .eq("cohort_id", cohortId)
    .eq("session_date", dateStr)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .schema("delivery")
    .from("attendance_sessions")
    .insert({ cohort_id: cohortId, session_date: dateStr, is_holiday: false, marked_by: markedBy })
    .select("id, is_holiday, holiday_name")
    .single();

  if (error) throw error;
  return data;
}

export async function setHoliday(cohortId: string, dateStr: string, isHoliday: boolean, holidayName: string | undefined, markedBy: string) {
  const supabase = await createClient();
  const session = await findOrCreateSession(cohortId, dateStr, markedBy);

  const { error } = await supabase
    .schema("delivery")
    .from("attendance_sessions")
    .update({
      is_holiday: isHoliday,
      holiday_name: isHoliday ? holidayName || null : null,
      marked_by: markedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) throw error;
}

export async function saveAttendanceForDate(
  cohortId: string,
  dateStr: string,
  records: { student_id: string; status: AttendanceStatus }[],
  markedBy: string
) {
  const supabase = await createClient();
  const session = await findOrCreateSession(cohortId, dateStr, markedBy);

  // Ensure session is not marked as a holiday once actual attendance is recorded
  if (session.is_holiday) {
    await supabase
      .schema("delivery")
      .from("attendance_sessions")
      .update({ is_holiday: false, holiday_name: null, updated_at: new Date().toISOString() })
      .eq("id", session.id);
  }

  for (const record of records) {
    const { data: existing } = await supabase
      .schema("delivery")
      .from("attendance_records")
      .select("id")
      .eq("session_id", session.id)
      .eq("student_id", record.student_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .schema("delivery")
        .from("attendance_records")
        .update({ status: record.status, marked_by: markedBy, marked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .schema("delivery")
        .from("attendance_records")
        .insert({ session_id: session.id, student_id: record.student_id, status: record.status, marked_by: markedBy });
      if (error) throw error;
    }
  }
}

export async function setAttendanceStatus(cohortId: string, dateStr: string, studentId: string, status: AttendanceStatus, markedBy: string) {
  await saveAttendanceForDate(cohortId, dateStr, [{ student_id: studentId, status }], markedBy);
}

export interface StudentAttendanceStats {
  studentId: string;
  name: string;
  email: string;
  present: number;
  absent: number;
  late: number;
  workingDays: number;
  percentage: number;
}

export interface AttendanceStats {
  workingDays: number;
  holidays: number;
  totalDays: number;
  students: StudentAttendanceStats[];
}

export async function getCohortAttendanceStats(cohortId: string): Promise<AttendanceStats> {
  const register = await getCohortAttendanceRegister(cohortId);

  const workingDates = register.dates.filter((d) => !d.isHoliday);
  const workingDays = workingDates.length;
  const holidays = register.dates.length - workingDays;

  const students: StudentAttendanceStats[] = register.students.map((student) => {
    const studentRecords = register.records[student.id] || {};
    let present = 0;
    let absent = 0;
    let late = 0;

    for (const dateInfo of workingDates) {
      const status = studentRecords[dateInfo.date];
      if (status === "present") present++;
      else if (status === "late") late++;
      else if (status === "absent") absent++;
    }

    const marked = present + absent + late;
    const percentage = marked > 0 ? Math.round(((present + late) / marked) * 1000) / 10 : 100;

    return {
      studentId: student.id,
      name: student.full_name,
      email: student.email,
      present,
      absent,
      late,
      workingDays,
      percentage,
    };
  });

  return { workingDays, holidays, totalDays: register.dates.length, students };
}

export async function getStudentAttendanceSummary(cohortId: string, studentId: string) {
  const stats = await getCohortAttendanceStats(cohortId);
  return stats.students.find((s) => s.studentId === studentId) || null;
}
