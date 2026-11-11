"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser } from "@/services/auth";
import * as libraryService from "@/services/library";

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

async function verifySuperAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized.");
  if (user.primaryRole !== "super_admin") {
    throw new Error("Access denied. Super Admin privileges required.");
  }
  return user;
}

export async function listCourseTemplatesAction() {
  try {
    await verifySuperAdmin();
    const data = await libraryService.listCourseTemplates();
    return { success: true, templates: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to list course templates.") };
  }
}

export async function createCourseTemplateAction(input: libraryService.CourseTemplateInput) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.createCourseTemplate(input);
    revalidateTag("course-templates", "max");
    revalidatePath("/admin");
    return { success: true, template: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create course template.") };
  }
}

export async function updateCourseTemplateAction(id: string, input: Partial<libraryService.CourseTemplateInput>) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.updateCourseTemplate(id, input);
    revalidateTag("course-templates", "max");
    revalidatePath("/admin");
    return { success: true, template: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update course template.") };
  }
}

export async function deleteCourseTemplateAction(id: string) {
  try {
    await verifySuperAdmin();
    await libraryService.deleteCourseTemplate(id);
    revalidateTag("course-templates", "max");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete course template.") };
  }
}

// Modules
export async function listModuleTemplatesAction(courseTemplateId: string) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.listModuleTemplates(courseTemplateId);
    return { success: true, modules: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to list module templates.") };
  }
}

export async function createModuleTemplateAction(input: libraryService.ModuleTemplateInput) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.createModuleTemplate(input);
    return { success: true, module: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create module template.") };
  }
}

export async function updateModuleTemplateAction(id: string, input: Partial<libraryService.ModuleTemplateInput>) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.updateModuleTemplate(id, input);
    return { success: true, module: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update module template.") };
  }
}

export async function deleteModuleTemplateAction(id: string) {
  try {
    await verifySuperAdmin();
    await libraryService.deleteModuleTemplate(id);
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete module template.") };
  }
}

// Lessons
export async function listLessonTemplatesAction(moduleTemplateId: string) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.listLessonTemplates(moduleTemplateId);
    return { success: true, lessons: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to list lesson templates.") };
  }
}

export async function createLessonTemplateAction(input: libraryService.LessonTemplateInput) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.createLessonTemplate(input);
    return { success: true, lesson: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create lesson template.") };
  }
}

export async function updateLessonTemplateAction(id: string, input: Partial<libraryService.LessonTemplateInput>) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.updateLessonTemplate(id, input);
    return { success: true, lesson: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update lesson template.") };
  }
}

export async function deleteLessonTemplateAction(id: string) {
  try {
    await verifySuperAdmin();
    await libraryService.deleteLessonTemplate(id);
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete lesson template.") };
  }
}

// Resources
export async function listResourceTemplatesAction(lessonTemplateId: string) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.listResourceTemplates(lessonTemplateId);
    return { success: true, resources: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to list resource templates.") };
  }
}

export async function createResourceTemplateAction(input: libraryService.ResourceTemplateInput) {
  try {
    await verifySuperAdmin();
    const data = await libraryService.createResourceTemplate(input);
    return { success: true, resource: data };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create resource template.") };
  }
}

export async function deleteResourceTemplateAction(id: string) {
  try {
    await verifySuperAdmin();
    await libraryService.deleteResourceTemplate(id);
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete resource template.") };
  }
}

// Instantiation action
export async function instantiateCourseTemplateAction(
  templateId: string,
  programId: string,
  tenantId: string,
  institutionId: string
) {
  try {
    await verifySuperAdmin();
    const courseId = await libraryService.instantiateCourseTemplate(
      templateId,
      programId,
      tenantId,
      institutionId
    );
    revalidatePath("/academic");
    revalidatePath("/admin");
    return { success: true, courseId };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to instantiate template course.") };
  }
}
