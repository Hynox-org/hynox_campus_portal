"use server";

import { getCurrentUser } from "@/services/auth";
import {
  getCohortAttendanceRegister,
  setHoliday,
  saveAttendanceForDate,
  setAttendanceStatus,
  getCohortAttendanceStats,
  getStudentAttendanceSummary,
  verifyAttendanceMarkingPermission,
  AttendanceStatus,
} from "@/services/attendance";
import { revalidatePath } from "next/cache";

// Server-side "today" in local time, matching the client's date-string format (YYYY-MM-DD).
function serverTodayStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().substring(0, 10);
}

async function requirePermission(cohortId: string, dateStr?: string) {
  const userDetails = await getCurrentUser();
  if (!userDetails) {
    return { error: "Unauthenticated. Please log in." } as const;
  }

  const hasPermission = await verifyAttendanceMarkingPermission(cohortId, userDetails.user.id, userDetails.primaryRole);
  if (!hasPermission) {
    return { error: "Access denied. Only assigned teachers or super admins can mark attendance." } as const;
  }

  // Teachers/trainers may only mark or change attendance for the present day.
  // Once a day has passed, their entries are locked; Super Admins are exempt.
  if (dateStr && userDetails.primaryRole !== "super_admin") {
    if (dateStr !== serverTodayStr()) {
      return { error: "Teachers can only mark attendance for the present day. Past and future dates are locked." } as const;
    }
  }

  return { userDetails } as const;
}

export async function getAttendanceRegisterAction(cohortId: string) {
  try {
    const register = await getCohortAttendanceRegister(cohortId);
    return { success: true, register };
  } catch (error: any) {
    return { error: error.message || "Failed to load attendance register." };
  }
}

export async function markHolidayAction(cohortId: string, dateStr: string, holidayName?: string) {
  const check = await requirePermission(cohortId, dateStr);
  if ("error" in check) return check;

  try {
    await setHoliday(cohortId, dateStr, true, holidayName, check.userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/teacher");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to mark holiday." };
  }
}

export async function unmarkHolidayAction(cohortId: string, dateStr: string) {
  const check = await requirePermission(cohortId, dateStr);
  if ("error" in check) return check;

  try {
    await setHoliday(cohortId, dateStr, false, undefined, check.userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/teacher");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to unmark holiday." };
  }
}

export async function bulkMarkAttendanceAction(cohortId: string, dateStr: string, studentIds: string[], status: AttendanceStatus) {
  const check = await requirePermission(cohortId, dateStr);
  if ("error" in check) return check;

  try {
    await saveAttendanceForDate(
      cohortId,
      dateStr,
      studentIds.map((studentId) => ({ student_id: studentId, status })),
      check.userDetails.user.id
    );
    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/student");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to save attendance." };
  }
}

export async function setAttendanceStatusAction(cohortId: string, dateStr: string, studentId: string, status: AttendanceStatus) {
  const check = await requirePermission(cohortId, dateStr);
  if ("error" in check) return check;

  try {
    await setAttendanceStatus(cohortId, dateStr, studentId, status, check.userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/student");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update attendance record." };
  }
}

export async function getAttendanceStatsAction(cohortId: string) {
  try {
    const stats = await getCohortAttendanceStats(cohortId);
    return { success: true, stats };
  } catch (error: any) {
    return { error: error.message || "Failed to compute attendance statistics." };
  }
}

export async function getStudentAttendanceSummaryAction(cohortId: string, studentId: string) {
  try {
    const summary = await getStudentAttendanceSummary(cohortId, studentId);
    return { success: true, summary };
  } catch (error: any) {
    return { error: error.message || "Failed to load student attendance summary." };
  }
}
