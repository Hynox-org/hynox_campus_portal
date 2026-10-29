"use server";

import * as academicService from "@/services/academic";
import * as deliveryService from "@/services/delivery";
import * as learningService from "@/services/learning";
import { listQuizAttemptsAction } from "@/app/actions/learning-actions";
import { listOnboardingInvitations } from "@/services/onboarding";
import { listInstitutions, listInstitutionUsers } from "@/services/institution";
import { requireInstitutionAccess } from "@/services/institution-access";
import { getCurrentUser } from "@/services/auth";
import { assignedCourseIds } from "@/services/academic-access";

export async function getInstitutionPrefetchDataAction(institutionId: string) {
  try {
    const current = await requireInstitutionAccess(institutionId);
    let [programs, courses] = await Promise.all([
      academicService.listPrograms(institutionId, current.primaryRole),
      academicService.listTenantCourses(institutionId)
    ]);
    if (["student", "teacher", "trainer"].includes(current.primaryRole)) {
      const assigned = await assignedCourseIds(current.user.id, current.primaryRole);
      courses = courses.filter(course => assigned.has(course.id));
      if (current.primaryRole === "student") {
        courses = courses.filter(course => course.status?.code === "active" && course.visibility?.code !== "private");
        programs = programs.filter(program => program.status?.code === "active" && program.visibility?.code !== "private");
      }
      const programIds = new Set(courses.map(course => course.program_id));
      programs = programs.filter(program => programIds.has(program.id));
      const visiblePrograms = new Set(programs.map(program => program.id));
      courses = courses.filter(course => visiblePrograms.has(course.program_id));
    }

    const courseIds = courses.map(c => c.id);
    let modules: Awaited<ReturnType<typeof academicService.listModules>> = [];
    let lessons: Awaited<ReturnType<typeof academicService.listLessons>> = [];

    if (courseIds.length > 0) {
      // Fetch modules for all courses in parallel
      const modulesResults = await Promise.all(
        courseIds.map((cId: string) => academicService.listModules(cId))
      );
      modules = modulesResults.flat().filter(module => current.primaryRole !== "student" || module.status?.code === "active");

      const moduleIds = modules.map(m => m.id);
      if (moduleIds.length > 0) {
        // Fetch lessons for all modules in parallel
        const lessonsResults = await Promise.all(
          moduleIds.map((mId: string) => academicService.listLessons(mId))
        );
        lessons = lessonsResults.flat().filter(lesson => current.primaryRole !== "student" || lesson.status?.code === "active");
      }
    }

    return { success: true, programs, courses, modules, lessons };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to prefetch academic data" };
  }
}

export async function getDeliveryPrefetchDataAction(institutionId: string) {
  try {
    const current = await requireInstitutionAccess(institutionId, true);
    const [cohorts, enrollments, assignments, users] = await Promise.all([
      deliveryService.listCohorts(institutionId),
      deliveryService.listEnrollments(institutionId),
      deliveryService.listCourseAssignments(institutionId),
      listInstitutionUsers(institutionId)
    ]);

    const enrolledIds = new Set(enrollments.map(enrollment => enrollment.user_id));
    const teacher = ["teacher", "trainer"].includes(current.primaryRole);
    const students = users.filter(u => u.roles.includes("student") && (!teacher || enrolledIds.has(u.id)));
    const instructors = users.filter(u => u.roles.some(r => ["teacher", "trainer"].includes(r)) && (!teacher || u.id === current.user.id));

    return {
      success: true,
      cohorts,
      enrollments,
      assignments,
      students,
      instructors
    };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to prefetch delivery data" };
  }
}

export async function getLearningPrefetchDataAction(institutionId: string) {
  try {
    await requireInstitutionAccess(institutionId, true);
    const [activities, projectSubmissions, challengeSubmissions, quizAttemptsRes] = await Promise.all([
      learningService.listAllActivities(institutionId),
      learningService.listProjectSubmissions(institutionId),
      learningService.listChallengeSubmissions(institutionId),
      listQuizAttemptsAction(institutionId)
    ]);

    if (quizAttemptsRes.error) throw new Error("Unable to load quiz attempts.");
    return {
      success: true,
      activities,
      quizAttempts: quizAttemptsRes.attempts || [],
      projectSubmissions,
      challengeSubmissions
    };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to prefetch learning data" };
  }
}

export async function getAdminPrefetchDataAction() {
  try {
    if ((await getCurrentUser(true))?.primaryRole !== "super_admin") return { error: "Access denied." };
    const [institutions, invitations] = await Promise.all([
      listInstitutions(),
      listOnboardingInvitations()
    ]);

    return {
      success: true,
      institutions: institutions || [],
      invitations: invitations || []
    };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to prefetch admin data" };
  }
}
