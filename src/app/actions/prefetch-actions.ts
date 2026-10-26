"use server";

import * as academicService from "@/services/academic";
import * as deliveryService from "@/services/delivery";
import * as learningService from "@/services/learning";
import { listQuizAttemptsAction } from "@/app/actions/learning-actions";
import { listOnboardingInvitations } from "@/services/onboarding";
import { listInstitutions, listInstitutionUsers } from "@/services/institution";
import { requireInstitutionAccess } from "@/services/institution-access";
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";

export async function getInstitutionPrefetchDataAction(institutionId: string) {
  try {
    const current = await requireInstitutionAccess(institutionId);
    let [programs, courses] = await Promise.all([
      academicService.listPrograms(institutionId, current.primaryRole),
      academicService.listTenantCourses(institutionId)
    ]);
    if (current.primaryRole === "student") {
      const supabase = await createClient();
      const { data: enrollments, error: enrollmentError } = await supabase.schema("delivery").from("enrollments")
        .select("cohort_id").eq("user_id", current.user.id).eq("status_code", "active").is("deleted_at", null);
      if (enrollmentError) throw enrollmentError;
      const cohortIds = (enrollments || []).map(enrollment => enrollment.cohort_id);
      const assignments = cohortIds.length
        ? await supabase.schema("delivery").from("course_assignments").select("course_id")
          .in("cohort_id", cohortIds).is("deleted_at", null)
        : { data: [], error: null };
      if (assignments.error) throw assignments.error;
      const assignedCourseIds = new Set((assignments.data || []).map(assignment => assignment.course_id));
      courses = courses.filter(course => assignedCourseIds.has(course.id));
      const assignedProgramIds = new Set(courses.map(course => course.program_id));
      programs = programs.filter(program => assignedProgramIds.has(program.id));
    }
    
    const courseIds = courses.map(c => c.id);
    let modules: Awaited<ReturnType<typeof academicService.listModules>> = [];
    let lessons: Awaited<ReturnType<typeof academicService.listLessons>> = [];

    if (courseIds.length > 0) {
      // Fetch modules for all courses in parallel
      const modulesResults = await Promise.all(
        courseIds.map((cId: string) => academicService.listModules(cId))
      );
      modules = modulesResults.flat();

      const moduleIds = modules.map(m => m.id);
      if (moduleIds.length > 0) {
        // Fetch lessons for all modules in parallel
        const lessonsResults = await Promise.all(
          moduleIds.map((mId: string) => academicService.listLessons(mId))
        );
        lessons = lessonsResults.flat();
      }
    }

    return { success: true, programs, courses, modules, lessons };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Failed to prefetch academic data" };
  }
}

export async function getDeliveryPrefetchDataAction(institutionId: string) {
  try {
    await requireInstitutionAccess(institutionId, true);
    const [cohorts, enrollments, assignments, users] = await Promise.all([
      deliveryService.listCohorts(institutionId),
      deliveryService.listEnrollments(institutionId),
      deliveryService.listCourseAssignments(institutionId),
      listInstitutionUsers(institutionId)
    ]);

    const students = users.filter(u => u.roles.includes("student"));
    const instructors = users.filter(u => u.roles.some(r => ["teacher", "trainer"].includes(r)));

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
    if ((await getCurrentUser())?.primaryRole !== "super_admin") return { error: "Access denied." };
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
