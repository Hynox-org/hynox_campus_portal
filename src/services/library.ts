import { createClient } from "@/utils/supabase/server";
import { getSessionTenant } from "./academic";
import { validateInstitutionId } from "@/lib/institution-validation";
import { validateBlueprintInput } from "@/lib/library-validation";

async function requireLibraryAdmin() {
  const session = await getSessionTenant();
  if (!session?.roles?.includes("super_admin")) throw new Error("Access denied. Super Admin privileges required.");
  return session;
}

export interface CourseTemplateInput {
  title: string;
  slug: string;
  description?: string;
  category_code?: string;
  course_type_code?: string;
  enrollment_mode?: string;
  duration_minutes?: number;
  thumbnail_path?: string;
  is_published?: boolean;
}

export interface ModuleTemplateInput {
  course_template_id: string;
  title: string;
  description?: string;
  position?: number;
}

export interface LessonTemplateInput {
  module_template_id: string;
  title: string;
  lesson_type_code?: string;
  content_json?: unknown;
  video_url?: string;
  duration?: number;
  position?: number;
  is_preview?: boolean;
}

export interface ResourceTemplateInput {
  lesson_template_id: string;
  resource_type: string;
  title: string;
  file_url?: string;
  external_url?: string;
  position?: number;
}

// Course Templates
export async function listCourseTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("library")
    .from("course_templates")
    .select("*")
    .is("deleted_at", null)
    .order("title");

  if (error) throw error;
  return data || [];
}

export async function getCourseTemplate(id: string) {
  validateInstitutionId(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("library")
    .from("course_templates")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function createCourseTemplate(input: CourseTemplateInput) {
  input = validateBlueprintInput(input, "course", false);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { data, error } = await supabase
    .schema("library")
    .from("course_templates")
    .insert({
      title: input.title,
      slug: input.slug,
      description: input.description,
      category_code: input.category_code || null,
      course_type_code: input.course_type_code || "theory",
      enrollment_mode: input.enrollment_mode || "open",
      duration_minutes: input.duration_minutes || 0,
      thumbnail_path: input.thumbnail_path || null,
      version: 1,
      is_latest: true,
      is_published: input.is_published ?? false,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCourseTemplate(id: string, input: Partial<CourseTemplateInput>) {
  validateInstitutionId(id);
  input = validateBlueprintInput(input, "course", true);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { data, error } = await supabase
    .schema("library")
    .from("course_templates")
    .update({
      title: input.title,
      slug: input.slug,
      description: input.description,
      category_code: input.category_code,
      course_type_code: input.course_type_code,
      enrollment_mode: input.enrollment_mode,
      duration_minutes: input.duration_minutes,
      thumbnail_path: input.thumbnail_path,
      is_published: input.is_published,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCourseTemplate(id: string) {
  validateInstitutionId(id);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { error } = await supabase
    .schema("library")
    .from("course_templates")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) throw error;
  return true;
}

// Module Templates
export async function listModuleTemplates(courseTemplateId: string) {
  validateInstitutionId(courseTemplateId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("library")
    .from("module_templates")
    .select("*")
    .eq("course_template_id", courseTemplateId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createModuleTemplate(input: ModuleTemplateInput) {
  input = validateBlueprintInput(input, "module", false);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { data, error } = await supabase
    .schema("library")
    .from("module_templates")
    .insert({
      course_template_id: input.course_template_id,
      title: input.title,
      description: input.description,
      position: input.position ?? 1,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateModuleTemplate(id: string, input: Partial<ModuleTemplateInput>) {
  validateInstitutionId(id);
  input = validateBlueprintInput(input, "module", true);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { data, error } = await supabase
    .schema("library")
    .from("module_templates")
    .update({
      title: input.title,
      description: input.description,
      position: input.position,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModuleTemplate(id: string) {
  validateInstitutionId(id);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { error } = await supabase
    .schema("library")
    .from("module_templates")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) throw error;
  return true;
}

// Lesson Templates
export async function listLessonTemplates(moduleTemplateId: string) {
  validateInstitutionId(moduleTemplateId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("library")
    .from("lesson_templates")
    .select("*")
    .eq("module_template_id", moduleTemplateId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLessonTemplate(input: LessonTemplateInput) {
  input = validateBlueprintInput(input, "lesson", false);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const code = (input.lesson_type_code || "").toLowerCase();
  if (code === "assignment" || code === "assessment") {
    throw new Error("Assessment and assignment type lessons cannot be added inside a course library.");
  }

  const { data, error } = await supabase
    .schema("library")
    .from("lesson_templates")
    .insert({
      module_template_id: input.module_template_id,
      title: input.title,
      lesson_type_code: input.lesson_type_code || "text",
      content_json: input.content_json || {},
      video_url: input.video_url || null,
      duration: input.duration ?? 15,
      position: input.position ?? 1,
      is_preview: input.is_preview || false,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLessonTemplate(id: string, input: Partial<LessonTemplateInput>) {
  validateInstitutionId(id);
  input = validateBlueprintInput(input, "lesson", true);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  if (input.lesson_type_code) {
    const code = input.lesson_type_code.toLowerCase();
    if (code === "assignment" || code === "assessment") {
      throw new Error("Assessment and assignment type lessons cannot be added inside a course library.");
    }
  }

  const { data, error } = await supabase
    .schema("library")
    .from("lesson_templates")
    .update({
      title: input.title,
      lesson_type_code: input.lesson_type_code,
      content_json: input.content_json,
      video_url: input.video_url,
      duration: input.duration,
      position: input.position,
      is_preview: input.is_preview,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLessonTemplate(id: string) {
  validateInstitutionId(id);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { error } = await supabase
    .schema("library")
    .from("lesson_templates")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) throw error;
  return true;
}

// Resource Templates
export async function listResourceTemplates(lessonTemplateId: string) {
  validateInstitutionId(lessonTemplateId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("library")
    .from("resource_templates")
    .select("*")
    .eq("lesson_template_id", lessonTemplateId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createResourceTemplate(input: ResourceTemplateInput) {
  input = validateBlueprintInput(input, "resource", false);
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  const { data, error } = await supabase
    .schema("library")
    .from("resource_templates")
    .insert({
      lesson_template_id: input.lesson_template_id,
      resource_type: input.resource_type,
      title: input.title,
      file_url: input.file_url || null,
      external_url: input.external_url || null,
      position: input.position ?? 1,
      created_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteResourceTemplate(id: string) {
  validateInstitutionId(id);
  await requireLibraryAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .schema("library")
    .from("resource_templates")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) throw error;
  return true;
}

// Instantiation RPC caller
export async function instantiateCourseTemplate(
  templateId: string,
  programId: string,
  tenantId: string,
  institutionId: string
) {
  const supabase = await createClient();
  const session = await requireLibraryAdmin();

  for (const id of [templateId, programId, tenantId, institutionId]) validateInstitutionId(id);

  // Call the library.duplicate_course_template RPC
  const { data, error } = await supabase
    .schema("library")
    .rpc("duplicate_course_template", {
      p_template_id: templateId,
      p_program_id: programId,
      p_tenant_id: tenantId,
      p_institution_id: institutionId,
      p_user_id: session.userId
    });

  if (error) {
    console.error("RPC instantiation error:", error);
    throw new Error(error.message || "Failed to instantiate template course.");
  }
  return data; // Returns the instantiated course ID
}

export async function getCourseTemplateMetadata(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("library")
    .from("course_templates")
    .select("title, version")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;
  return data;
}
