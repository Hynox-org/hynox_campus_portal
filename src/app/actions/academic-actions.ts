 "use server";
import { errorMessage } from "@/lib/error-message";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import { requireAcademicRead, assignedCourseIds } from "@/services/academic-access";
import { requireInstitutionAccess } from "@/services/institution-access";
import * as academicService from "@/services/academic";

// Access authorization helper
async function verifyAdminOrTeacher() {
  const user = await getCurrentUser(true);
  if (!user?.user) throw new Error("Unauthorized.");
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
  } catch (error) {
    return { error: errorMessage(error, "Failed to create program.") };
  }
}

export async function updateProgramAction(id: string, input: Partial<academicService.ProgramInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateProgram(id, input);
    revalidatePath("/academic");
    revalidatePath(`/academic/${data.slug}`);
    return { success: true, program: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to update program.") };
  }
}

export async function deleteProgramAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteProgram(id);
    revalidatePath("/academic");
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to delete program.") };
  }
}

export async function createCourseAction(input: academicService.CourseInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createCourse(input);
    revalidatePath(`/academic/${input.program_id}`);
    return { success: true, course: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to create course.") };
  }
}

export async function updateCourseAction(id: string, input: Partial<academicService.CourseInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateCourse(id, input);
    revalidatePath("/academic");
    return { success: true, course: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to update course.") };
  }
}

export async function deleteCourseAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteCourse(id);
    revalidatePath("/academic");
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to delete course.") };
  }
}

export async function assignCourseInstructorsAction(courseId: string, instructorIds: string[]) {
  try {
    await verifyAdminOrTeacher();
    await academicService.assignCourseInstructors(courseId, instructorIds);
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to assign instructors.") };
  }
}

export async function createModuleAction(input: academicService.ModuleInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createModule(input);
    return { success: true, module: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to create module.") };
  }
}

export async function updateModuleAction(id: string, input: Partial<academicService.ModuleInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateModule(id, input);
    return { success: true, module: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to update module.") };
  }
}

export async function deleteModuleAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteModule(id);
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to delete module.") };
  }
}

export async function createLessonAction(input: academicService.LessonInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createLesson(input);
    return { success: true, lesson: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to create lesson.") };
  }
}

export async function updateLessonAction(id: string, input: Partial<academicService.LessonInput>) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.updateLesson(id, input);
    return { success: true, lesson: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to update lesson.") };
  }
}

export async function deleteLessonAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteLesson(id);
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to delete lesson.") };
  }
}

export async function createLessonResourceAction(input: academicService.LessonResourceInput) {
  try {
    await verifyAdminOrTeacher();
    const data = await academicService.createLessonResource(input);
    return { success: true, resource: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to create lesson resource.") };
  }
}

export async function deleteLessonResourceAction(id: string) {
  try {
    await verifyAdminOrTeacher();
    await academicService.deleteLessonResource(id);
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to delete lesson resource.") };
  }
}

export async function listLessonsAction(moduleId: string) {
  try {
    const user = await requireAcademicRead("modules", moduleId);
    const data = await academicService.listLessons(moduleId);
    return { success: true, lessons: user.primaryRole === "student" ? data.filter(item => item.status?.code === "active") : data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list lessons.") };
  }
}

export async function listLessonResourcesAction(lessonId: string) {
  try {
    await requireAcademicRead("lessons", lessonId);
    const data = await academicService.listLessonResources(lessonId);
    return { success: true, resources: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list resources.") };
  }
}

export async function listProgramsAction(tenantId: string) {
  try {
    const user = await requireInstitutionAccess(tenantId);
    const data = await academicService.listPrograms(tenantId, user.primaryRole);
    return { success: true, programs: user.primaryRole === "student" ? data.filter(program => program.visibility?.code !== "private") : data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list programs.") };
  }
}

export async function listCoursesAction(programId: string) {
  try {
    const user = await requireAcademicRead("programs", programId);
    let data = await academicService.listCourses(programId);
    if (["student", "teacher", "trainer"].includes(user.primaryRole)) {
      const assigned = await assignedCourseIds(user.user.id, user.primaryRole);
      data = data.filter(course => assigned.has(course.id));
    }
    return { success: true, courses: user.primaryRole === "student" ? data.filter(item => item.status?.code === "active" && item.visibility?.code !== "private") : data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list courses.") };
  }
}

export async function listModulesAction(courseId: string) {
  try {
    const user = await requireAcademicRead("courses", courseId);
    const data = await academicService.listModules(courseId);
    return { success: true, modules: user.primaryRole === "student" ? data.filter(item => item.status?.code === "active") : data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list modules.") };
  }
}

export async function getCourseInstructorsAction(courseId: string) {
  try {
    await requireAcademicRead("courses", courseId);
    const data = await academicService.getCourseInstructors(courseId);
    return { success: true, instructors: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to get instructors.") };
  }
}

export async function listTenantInstructorsAction(tenantId: string) {
  try {
    await requireInstitutionAccess(tenantId);
    const data = await academicService.listTenantInstructors(tenantId);
    return { success: true, instructors: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list tenant instructors.") };
  }
}

export async function getAcademicLookupsAction() {
  try {
    const data = await academicService.getAcademicLookups();
    return { success: true, lookups: data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to fetch lookups.") };
  }
}

export async function listTenantCoursesAction(tenantId: string) {
  try {
    const user = await requireInstitutionAccess(tenantId);
    let data = await academicService.listTenantCourses(tenantId);
    if (["student", "teacher", "trainer"].includes(user.primaryRole)) {
      const assigned = await assignedCourseIds(user.user.id, user.primaryRole);
      data = data.filter(course => assigned.has(course.id));
    }
    return { success: true, courses: user.primaryRole === "student" ? data.filter(course => course.status?.code === "active" && course.visibility?.code !== "private") : data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list tenant courses.") };
  }
}

export async function listLessonsForCourseAction(courseId: string) {
  try {
    const user = await requireAcademicRead("courses", courseId);
    const data = await academicService.listLessonsForCourse(courseId);
    return { success: true, lessons: user.primaryRole === "student" ? data.filter(item => item.status?.code === "active") : data };
  } catch (error) {
    return { error: errorMessage(error, "Failed to list lessons for course.") };
  }
}




