"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import * as deliveryService from "@/services/delivery";
import { listInstitutionUsers } from "@/services/institution";

async function verifyAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized.");
  const allowed = ["super_admin", "institution_admin", "teacher", "trainer"];
  if (!allowed.includes(user.primaryRole)) {
    throw new Error("Access denied. Insufficient permissions.");
  }
  return user;
}


export async function getDeliveryLookupsAction() {
  try {
    const data = await deliveryService.getDeliveryLookups();
    return { success: true, lookups: data };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch delivery lookups." };
  }
}

export async function listCohortsAction(tenantId: string) {
  try {
    await verifyAdmin();
    const data = await deliveryService.listCohorts(tenantId);
    return { success: true, cohorts: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list cohorts." };
  }
}

export async function createCohortAction(input: deliveryService.CohortInput) {
  try {
    await verifyAdmin();
    const data = await deliveryService.createCohort(input);
    revalidatePath("/admin");
    return { success: true, cohort: data };
  } catch (error: any) {
    return { error: error.message || "Failed to create cohort." };
  }
}

export async function updateCohortAction(id: string, input: Partial<deliveryService.CohortInput>) {
  try {
    await verifyAdmin();
    const data = await deliveryService.updateCohort(id, input);
    revalidatePath("/admin");
    return { success: true, cohort: data };
  } catch (error: any) {
    return { error: error.message || "Failed to update cohort." };
  }
}

export async function deleteCohortAction(id: string) {
  try {
    await verifyAdmin();
    await deliveryService.deleteCohort(id);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete cohort." };
  }
}

export async function listEnrollmentsAction(tenantId: string) {
  try {
    await verifyAdmin();
    const data = await deliveryService.listEnrollments(tenantId);
    return { success: true, enrollments: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list enrollments." };
  }
}

export async function enrollStudentAction(input: deliveryService.EnrollmentInput) {
  try {
    await verifyAdmin();
    const data = await deliveryService.enrollStudent(input);
    revalidatePath("/admin");
    return { success: true, enrollment: data };
  } catch (error: any) {
    return { error: error.message || "Failed to enroll student." };
  }
}

export async function updateEnrollmentStatusAction(id: string, status_code: string) {
  try {
    await verifyAdmin();
    const data = await deliveryService.updateEnrollmentStatus(id, status_code);
    revalidatePath("/admin");
    return { success: true, enrollment: data };
  } catch (error: any) {
    return { error: error.message || "Failed to update enrollment status." };
  }
}

export async function removeEnrollmentAction(id: string) {
  try {
    await verifyAdmin();
    await deliveryService.removeEnrollment(id);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to remove enrollment." };
  }
}

export async function listCourseAssignmentsAction(tenantId: string) {
  try {
    await verifyAdmin();
    const data = await deliveryService.listCourseAssignments(tenantId);
    return { success: true, assignments: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list course assignments." };
  }
}

export async function assignCourseAction(input: deliveryService.CourseAssignmentInput) {
  try {
    await verifyAdmin();
    const data = await deliveryService.assignCourse(input);
    revalidatePath("/admin");
    return { success: true, assignment: data };
  } catch (error: any) {
    return { error: error.message || "Failed to assign course." };
  }
}

export async function removeCourseAssignmentAction(id: string) {
  try {
    await verifyAdmin();
    await deliveryService.removeCourseAssignment(id);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to remove course assignment." };
  }
}

export async function listInstitutionStudentsAction(tenantId: string) {
  try {
    await verifyAdmin();
    const allUsers = await listInstitutionUsers(tenantId);
    const students = allUsers.filter(u => u.roles.includes("student"));
    return { success: true, students };
  } catch (error: any) {
    return { error: error.message || "Failed to list students." };
  }
}

export async function getStudentDeliveryDataAction(userId: string) {
  try {
    const data = await deliveryService.getStudentDeliveryData(userId);
    return { success: true, programs: data };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch student programs and courses." };
  }
}

export async function getLessonProgressAction(userId: string, lessonId: string) {
  try {
    const data = await deliveryService.getLessonProgress(userId, lessonId);
    return { success: true, progress: data };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch lesson progress." };
  }
}

export async function startOrUpdateLessonProgressAction(userId: string, lessonId: string, courseId: string) {
  try {
    const data = await deliveryService.startOrUpdateLessonProgress(userId, lessonId, courseId);
    revalidatePath("/student");
    return { success: true, progress: data };
  } catch (error: any) {
    return { error: error.message || "Failed to start/update lesson progress." };
  }
}

export async function completeLessonProgressAction(userId: string, lessonId: string, courseId: string) {
  try {
    const data = await deliveryService.completeLessonProgress(userId, lessonId, courseId);
    revalidatePath("/student");
    return { success: true, progress: data };
  } catch (error: any) {
    return { error: error.message || "Failed to complete lesson progress." };
  }
}

export async function listStudentLessonProgressAction(userId: string) {
  try {
    const data = await deliveryService.listStudentLessonProgress(userId);
    return { success: true, progressList: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list student lesson progress." };
  }
}
