 "use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import * as academicService from "@/services/academic";

// Access authorization helper
async function verifyAdminOrTeacher() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized.");
  const allowed = ["super_admin", "institution_admin", "teacher", "trainer"];
  if (!allowed.includes(user.primaryRole)) {
    throw new Error("Access denied. Insufficient permissions.");
  }
  return user;
}

export async function createProgramAction(input: academicService.ProgramInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createProgram(input);
    revalidatePath("/academic");
    return { success: true, program: data };
  } catch (error: any) {
    return { error: error.message || "Failed to create program." };
  }
}

export async function updateProgramAction(id: string, input: Partial<academicService.ProgramInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateProgram(id, input);
    revalidatePath("/academic");
    revalidatePath(`/academic/${data.slug}`);
    return { success: true, program: data };
  } catch (error: any) {
    return { error: error.message || "Failed to update program." };
  }
}

export async function deleteProgramAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteProgram(id);
    revalidatePath("/academic");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete program." };
  }
}

export async function createCourseAction(input: academicService.CourseInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createCourse(input);
    revalidatePath(`/academic/${input.program_id}`);
    return { success: true, course: data };
  } catch (error: any) {
    return { error: error.message || "Failed to create course." };
  }
}

export async function updateCourseAction(id: string, input: Partial<academicService.CourseInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateCourse(id, input);
    revalidatePath("/academic");
    return { success: true, course: data };
  } catch (error: any) {
    return { error: error.message || "Failed to update course." };
  }
}

export async function deleteCourseAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteCourse(id);
    revalidatePath("/academic");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete course." };
  }
}

export async function assignCourseInstructorsAction(courseId: string, instructorIds: string[]) {
  try {
    await verifyAdminOrTeacher();
    await academicService.assignCourseInstructors(courseId, instructorIds);
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to assign instructors." };
  }
}

export async function createModuleAction(input: academicService.ModuleInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createModule(input);
    return { success: true, module: data };
  } catch (error: any) {
    return { error: error.message || "Failed to create module." };
  }
}

export async function updateModuleAction(id: string, input: Partial<academicService.ModuleInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateModule(id, input);
    return { success: true, module: data };
  } catch (error: any) {
    return { error: error.message || "Failed to update module." };
  }
}

export async function deleteModuleAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteModule(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete module." };
  }
}

export async function createLessonAction(input: academicService.LessonInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createLesson(input);
    return { success: true, lesson: data };
  } catch (error: any) {
    return { error: error.message || "Failed to create lesson." };
  }
}

export async function updateLessonAction(id: string, input: Partial<academicService.LessonInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateLesson(id, input);
    return { success: true, lesson: data };
  } catch (error: any) {
    return { error: error.message || "Failed to update lesson." };
  }
}

export async function deleteLessonAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteLesson(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete lesson." };
  }
}

export async function createLessonResourceAction(input: academicService.LessonResourceInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createLessonResource(input);
    return { success: true, resource: data };
  } catch (error: any) {
    return { error: error.message || "Failed to create lesson resource." };
  }
}

export async function deleteLessonResourceAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteLessonResource(id);
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete lesson resource." };
  }
}

export async function listLessonsAction(moduleId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listLessons(moduleId);
    return { success: true, lessons: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list lessons." };
  }
}

export async function listLessonResourcesAction(lessonId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listLessonResources(lessonId);
    return { success: true, resources: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list resources." };
  }
}

export async function listProgramsAction(tenantId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listPrograms(tenantId, user.primaryRole);
    return { success: true, programs: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list programs." };
  }
}

export async function listCoursesAction(programId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listCourses(programId);
    return { success: true, courses: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list courses." };
  }
}

export async function listModulesAction(courseId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listModules(courseId);
    return { success: true, modules: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list modules." };
  }
}

export async function getCourseInstructorsAction(courseId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.getCourseInstructors(courseId);
    return { success: true, instructors: data };
  } catch (error: any) {
    return { error: error.message || "Failed to get instructors." };
  }
}

export async function listTenantInstructorsAction(tenantId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listTenantInstructors(tenantId);
    return { success: true, instructors: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list tenant instructors." };
  }
}

export async function getAcademicLookupsAction() {
  try {
    const data = await academicService.getAcademicLookups();
    return { success: true, lookups: data };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch lookups." };
  }
}

export async function listTenantCoursesAction(tenantId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listTenantCourses(tenantId);
    return { success: true, courses: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list tenant courses." };
  }
}

export async function listLessonsForCourseAction(courseId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const data = await academicService.listLessonsForCourse(courseId);
    return { success: true, lessons: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list lessons for course." };
  }
}




