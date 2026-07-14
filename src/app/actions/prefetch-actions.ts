"use server";

import * as academicService from "@/services/academic";
import * as deliveryService from "@/services/delivery";
import * as learningService from "@/services/learning";
import { listQuizAttemptsAction } from "@/app/actions/learning-actions";
import { listOnboardingInvitations } from "@/services/onboarding";
import { listInstitutions, listInstitutionUsers } from "@/services/institution";

export async function getInstitutionPrefetchDataAction(institutionId: string) {
  try {
    const [programs, courses] = await Promise.all([
      academicService.listPrograms(institutionId, "super_admin"),
      academicService.listTenantCourses(institutionId)
    ]);
    
    const courseIds = courses.map((c: any) => c.id);
    let modules: any[] = [];
    let lessons: any[] = [];

    if (courseIds.length > 0) {
      // Fetch modules for all courses in parallel
      const modulesResults = await Promise.all(
        courseIds.map((cId: string) => academicService.listModules(cId))
      );
      modules = modulesResults.flat();

      const moduleIds = modules.map((m: any) => m.id);
      if (moduleIds.length > 0) {
        // Fetch lessons for all modules in parallel
        const lessonsResults = await Promise.all(
          moduleIds.map((mId: string) => academicService.listLessons(mId))
        );
        lessons = lessonsResults.flat();
      }
    }

    return { success: true, programs, courses, modules, lessons };
  } catch (error: any) {
    return { error: error.message || "Failed to prefetch academic data" };
  }
}

export async function getDeliveryPrefetchDataAction(institutionId: string) {
  try {
    const [cohorts, enrollments, assignments, users] = await Promise.all([
      deliveryService.listCohorts(institutionId),
      deliveryService.listEnrollments(institutionId),
      deliveryService.listCourseAssignments(institutionId),
      listInstitutionUsers(institutionId)
    ]);

    const students = users.filter((u: any) => u.roles?.includes("student"));
    const instructors = users.filter((u: any) => u.roles?.some((r: string) => ["teacher", "trainer"].includes(r)));

    return {
      success: true,
      cohorts,
      enrollments,
      assignments,
      students,
      instructors
    };
  } catch (error: any) {
    return { error: error.message || "Failed to prefetch delivery data" };
  }
}

export async function getLearningPrefetchDataAction(institutionId: string) {
  try {
    const [activities, projectSubmissions, challengeSubmissions, quizAttemptsRes] = await Promise.all([
      learningService.listAllActivities(institutionId),
      learningService.listProjectSubmissions(institutionId),
      learningService.listChallengeSubmissions(institutionId),
      listQuizAttemptsAction(institutionId)
    ]);

    return {
      success: true,
      activities,
      quizAttempts: quizAttemptsRes.attempts || [],
      projectSubmissions,
      challengeSubmissions
    };
  } catch (error: any) {
    return { error: error.message || "Failed to prefetch learning data" };
  }
}

export async function getAdminPrefetchDataAction() {
  try {
    const [institutions, invitations] = await Promise.all([
      listInstitutions(),
      listOnboardingInvitations()
    ]);

    return {
      success: true,
      institutions: institutions || [],
      invitations: invitations || []
    };
  } catch (error: any) {
    return { error: error.message || "Failed to prefetch admin data" };
  }
}
