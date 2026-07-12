import { createClient } from "@/utils/supabase/server";

export interface AttendanceSession {
  id?: string;
  cohort_id: string;
  session_date: string;
  is_holiday: boolean;
  holiday_name?: string;
  marked_by?: string;
}

export interface AttendanceRecord {
  student_id: string;
  status: "present" | "absent" | "late";
}

// Check if a user is a Teacher assigned to the cohort or a Super Admin
export async function verifyAttendanceMarkingPermission(cohortId: string, userId: string, userRole: string) {
  if (userRole === "super_admin") return true;
  if (userRole !== "teacher") return false;

  const supabase = await createClient();

  // A teacher can mark attendance if the cohort belongs to their institution
  const { data: cohort, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("institution_id")
    .eq("id", cohortId)
    .single();

  if (error || !cohort) return false;

  // Let's check if this teacher is assigned to this cohort's institution
  const { data: teacherInst, error: instError } = await supabase
    .schema("core")
    .from("users")
    .select("tenant_id, institution_id")
    .eq("id", userId)
    .single();

  if (instError || !teacherInst) return false;

  return teacherInst.institution_id === cohort.institution_id || teacherInst.tenant_id === cohort.institution_id;
}

// Fetch a session by date
export async function getAttendanceSession(cohortId: string, dateStr: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("delivery")
    .from("attendance_sessions")
    .select("*")
    .eq("cohort_id", cohortId)
    .eq("session_date", dateStr)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Upsert session (Active or Holiday)
export async function upsertAttendanceSession(input: AttendanceSession) {
  const supabase = await createClient();
  
  // Try to find if it exists
  const existing = await getAttendanceSession(input.cohort_id, input.session_date);

  if (existing) {
    const { data, error } = await supabase
      .schema("delivery")
      .from("attendance_sessions")
      .update({
        is_holiday: input.is_holiday,
        holiday_name: input.holiday_name || null,
        marked_by: input.marked_by,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .schema("delivery")
      .from("attendance_sessions")
      .insert({
        cohort_id: input.cohort_id,
        session_date: input.session_date,
        is_holiday: input.is_holiday,
        holiday_name: input.holiday_name || null,
        marked_by: input.marked_by
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Save student records for a session
export async function saveAttendanceRecords(
  sessionId: string,
  records: AttendanceRecord[],
  markedByUserId: string
) {
  const supabase = await createClient();

  // For each record, upsert
  for (const record of records) {
    const { data: existing } = await supabase
      .schema("delivery")
      .from("attendance_records")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", record.student_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .schema("delivery")
        .from("attendance_records")
        .update({
          status: record.status,
          marked_by: markedByUserId,
          marked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .schema("delivery")
        .from("attendance_records")
        .insert({
          session_id: sessionId,
          student_id: record.student_id,
          status: record.status,
          marked_by: markedByUserId
        });

      if (error) throw error;
    }
  }
}

// Get active session records (students + status)
export async function getAttendanceSessionRecords(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("delivery")
    .from("attendance_records")
    .select("*")
    .eq("session_id", sessionId)
    .is("deleted_at", null);

  if (error) throw error;
  return data || [];
}

// Generate the final attendance analytics report for a cohort
export async function getCohortAttendanceReport(cohortId: string) {
  const supabase = await createClient();

  // 1. Fetch cohort metadata
  const { data: cohort, error: cohortError } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("id, name, code, start_date, end_date")
    .eq("id", cohortId)
    .single();

  if (cohortError || !cohort) throw new Error("Cohort not found.");

  // 2. Fetch all sessions
  const { data: sessions } = await supabase
    .schema("delivery")
    .from("attendance_sessions")
    .select("*")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null)
    .order("session_date", { ascending: true });

  const activeSessions = (sessions || []).filter(s => !s.is_holiday);
  const sessionIds = activeSessions.map(s => s.id);

  // 3. Fetch all attendance records for these sessions
  let records: any[] = [];
  if (sessionIds.length > 0) {
    const { data: recordData } = await supabase
      .schema("delivery")
      .from("attendance_records")
      .select("*")
      .in("session_id", sessionIds)
      .is("deleted_at", null);
    records = recordData || [];
  }

  // 4. Fetch enrolled students
  const { data: enrollments } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null);

  const studentIds = (enrollments || []).map(e => e.user_id);
  let students: any[] = [];
  if (studentIds.length > 0) {
    const { data: userData } = await supabase
      .schema("core")
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);
    students = userData || [];
  }

  // Compute student stats
  const totalActiveSessions = activeSessions.length;

    const studentStats = students.map(student => {
    const studentRecords = records.filter(r => r.student_id === student.id);
    const presentCount = studentRecords.filter(r => r.status === "present" || r.status === "late").length;
    const absentCount = studentRecords.filter(r => r.status === "absent").length;
    const lateCount = studentRecords.filter(r => r.status === "late").length;

    // Attendance rate is Present / Total marked sessions.
    // If no sessions marked, standard is 100%.
    const rate = totalActiveSessions > 0 ? (presentCount / totalActiveSessions) * 100 : 100;

    return {
      id: student.id,
      name: student.full_name || student.email || "Student",
      email: student.email,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      totalSessions: totalActiveSessions,
      percentage: Math.round(rate * 10) / 10
    };
  });

  return {
    cohort,
    sessions: sessions || [],
    studentStats
  };
}

export async function getStudentAttendanceLogs(cohortId: string, studentId: string) {
  const report = await getCohortAttendanceReport(cohortId);
  const studentStat = report.studentStats.find(s => s.id === studentId);

  const resolvedLogs = [];
  for (const session of report.sessions) {
    const dateObj = new Date(session.session_date);
    const isSunday = dateObj.getDay() === 0;

    let status = "absent";
    if (session.is_holiday) {
      status = "Govt Holiday";
    } else if (isSunday) {
      status = "Sunday (Leave)";
    } else {
      const record = await getStudentAttendanceRecordForSession(session.id, studentId);
      if (record) {
        status = record.status;
      }
    }

    resolvedLogs.push({
      date: session.session_date,
      isHoliday: session.is_holiday,
      holidayName: session.holiday_name,
      isSunday,
      status
    });
  }

  return {
    percentage: studentStat ? studentStat.percentage : 100,
    logs: resolvedLogs
  };
}

async function getStudentAttendanceRecordForSession(sessionId: string, studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("delivery")
    .from("attendance_records")
    .select("status")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}
