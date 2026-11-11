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
import { attendanceToday } from "@/lib/attendance";
import { errorMessage } from "@/lib/error-message";
import { revalidatePath } from "next/cache";

async function requirePermission(cohortId: string, dateStr?: string) {
  try {
    const userDetails = await getCurrentUser(true);
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
      if (dateStr !== attendanceToday()) {
        return { error: "Teachers can only mark attendance for the present day. Past and future dates are locked." } as const;
      }
    }

    return { userDetails } as const;
  } catch (error) { return { error: errorMessage(error, "Unable to verify attendance access.") } as const; }
}

export async function getAttendanceRegisterAction(cohortId: string, studentId?: string) {
  try {
    const register = await getCohortAttendanceRegister(cohortId, studentId);
    return { success: true, register };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to load attendance register.") };
  }
}

export async function markHolidayAction(cohortId: string, dateStr: string, holidayName?: string) {
  const check = await requirePermission(cohortId, dateStr);
  if (!check.userDetails) return { error: check.error || "Access denied." };

  try {
    await setHoliday(cohortId, dateStr, true, holidayName, check.userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/institution");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to mark holiday.") };
  }
}

export async function unmarkHolidayAction(cohortId: string, dateStr: string) {
  const check = await requirePermission(cohortId, dateStr);
  if (!check.userDetails) return { error: check.error || "Access denied." };

  try {
    await setHoliday(cohortId, dateStr, false, undefined, check.userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/institution");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to unmark holiday.") };
  }
}

export async function bulkMarkAttendanceAction(cohortId: string, dateStr: string, studentIds: string[], status: AttendanceStatus) {
  const check = await requirePermission(cohortId, dateStr);
  if (!check.userDetails) return { error: check.error || "Access denied." };

  try {
    await saveAttendanceForDate(
      cohortId,
      dateStr,
      studentIds.map((studentId) => ({ student_id: studentId, status })),
      check.userDetails.user.id
    );
    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/institution");
    revalidatePath("/student");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to save attendance.") };
  }
}

export async function setAttendanceStatusAction(cohortId: string, dateStr: string, studentId: string, status: AttendanceStatus) {
  const check = await requirePermission(cohortId, dateStr);
  if (!check.userDetails) return { error: check.error || "Access denied." };

  try {
    await setAttendanceStatus(cohortId, dateStr, studentId, status, check.userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/teacher");
    revalidatePath("/institution");
    revalidatePath("/student");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update attendance record.") };
  }
}

export async function getAttendanceStatsAction(cohortId: string) {
  try {
    const stats = await getCohortAttendanceStats(cohortId);
    return { success: true, stats };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to compute attendance statistics.") };
  }
}

export async function getStudentAttendanceSummaryAction(cohortId: string, studentId: string) {
  try {
    const summary = await getStudentAttendanceSummary(cohortId, studentId);
    return { success: true, summary };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to load student attendance summary.") };
  }
}
