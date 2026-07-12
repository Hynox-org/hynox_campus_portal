"use server";

import { getCurrentUser } from "@/services/auth";
import { 
  getAttendanceSession,
  upsertAttendanceSession,
  saveAttendanceRecords,
  getCohortAttendanceReport,
  getStudentAttendanceLogs,
  verifyAttendanceMarkingPermission
} from "@/services/attendance";
import { revalidatePath } from "next/cache";

export async function getAttendanceSessionAction(cohortId: string, dateStr: string) {
  try {
    const session = await getAttendanceSession(cohortId, dateStr);
    return { success: true, session };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch session data." };
  }
}

export async function saveAttendanceAction(
  cohortId: string,
  dateStr: string,
  isHoliday: boolean,
  holidayName: string,
  records: { student_id: string; status: "present" | "absent" | "late" }[]
) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) {
      return { error: "Unauthenticated. Please log in." };
    }

    const hasPermission = await verifyAttendanceMarkingPermission(
      cohortId,
      userDetails.user.id,
      userDetails.primaryRole
    );

    if (!hasPermission) {
      return { error: "Access denied. Only assigned instructors or super admins can mark attendance." };
    }

    // Restriction: Present day only (ignore timezone difference helper to be safe)
    // Format current local date YYYY-MM-DD
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset*60*1000));
    const todayStr = localToday.toISOString().substring(0, 10);

    if (dateStr !== todayStr) {
      return { error: "Access denied. Attendance can only be marked for the present day." };
    }

    // 1. Upsert attendance session
    const session = await upsertAttendanceSession({
      cohort_id: cohortId,
      session_date: dateStr,
      is_holiday: isHoliday,
      holiday_name: isHoliday ? holidayName : undefined,
      marked_by: userDetails.user.id
    });

    // 2. Upsert attendance records if it's not a holiday
    if (!isHoliday && records && records.length > 0) {
      await saveAttendanceRecords(session.id, records, userDetails.user.id);
    }

    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/student");

    return { success: true, session };
  } catch (error: any) {
    return { error: error.message || "Failed to save attendance logs." };
  }
}

export async function getCohortAttendanceReportAction(cohortId: string) {
  try {
    const report = await getCohortAttendanceReport(cohortId);
    return { success: true, report };
  } catch (error: any) {
    return { error: error.message || "Failed to generate attendance report." };
  }
}

export async function getStudentAttendanceLogsAction(cohortId: string, studentId: string) {
  try {
    const logs = await getStudentAttendanceLogs(cohortId, studentId);
    return { success: true, logs };
  } catch (error: any) {
    return { error: error.message || "Failed to load student attendance logs." };
  }
}
