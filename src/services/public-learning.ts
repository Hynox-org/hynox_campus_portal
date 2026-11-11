import { createClient } from "@/utils/supabase/server";

export interface PublicResource {
  id: string;
  title: string;
  description: string | null;
  resource_type_code: string;
  resource_url: string;
}

export interface PublicLesson {
  id: string;
  title: string;
  content: string;
  video_url: string | null;
  resources: PublicResource[];
}

export interface PublicModule {
  id: string;
  title: string;
  description: string | null;
  lessons: PublicLesson[];
}

export interface PublicCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail_path: string | null;
  modules: PublicModule[];
}

const lessonContent = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const content = value as { body?: unknown; text?: unknown };
  return typeof content.body === "string" ? content.body : typeof content.text === "string" ? content.text : "";
};

export async function listPublicCourses(userId: string): Promise<PublicCourse[]> {
  const supabase = await createClient();
  const { data: entitlements, error: entitlementError } = await supabase.schema("delivery")
    .from("public_course_entitlements").select("course_template_id").eq("user_id", userId).eq("status", "active");
  if (entitlementError) throw new Error("Unable to load your course access.");
  const courseIds = [...new Set((entitlements || []).map(item => item.course_template_id))];
  if (!courseIds.length) return [];

  const { data: courses, error: courseError } = await supabase.schema("library").from("course_templates")
    .select("id,title,description,thumbnail_path").in("id", courseIds).is("deleted_at", null).order("title");
  if (courseError) throw new Error("Unable to load your courses.");
  const { data: modules, error: moduleError } = await supabase.schema("library").from("module_templates")
    .select("id,course_template_id,title,description,position").in("course_template_id", courseIds).is("deleted_at", null).order("position");
  if (moduleError) throw new Error("Unable to load course modules.");
  const moduleIds = (modules || []).map(item => item.id);
  const lessons = moduleIds.length ? await supabase.schema("library").from("lesson_templates")
    .select("id,module_template_id,title,content_json,video_url,position").in("module_template_id", moduleIds).is("deleted_at", null).order("position")
    : { data: [], error: null };
  if (lessons.error) throw new Error("Unable to load course lessons.");
  const lessonIds = (lessons.data || []).map(item => item.id);
  const resources = lessonIds.length ? await supabase.schema("library").from("resource_templates")
    .select("id,lesson_template_id,title,resource_type,file_url,external_url,position").in("lesson_template_id", lessonIds).is("deleted_at", null).order("position")
    : { data: [], error: null };
  if (resources.error) throw new Error("Unable to load lesson resources.");

  return (courses || []).map(course => ({
    ...course,
    modules: (modules || []).filter(module => module.course_template_id === course.id).map(module => ({
      id: module.id, title: module.title, description: module.description,
      lessons: (lessons.data || []).filter(lesson => lesson.module_template_id === module.id).map(lesson => ({
        id: lesson.id, title: lesson.title, content: lessonContent(lesson.content_json), video_url: lesson.video_url,
        resources: (resources.data || []).filter(resource => resource.lesson_template_id === lesson.id).map(resource => ({
          id: resource.id, title: resource.title, description: null,
          resource_type_code: resource.resource_type, resource_url: resource.file_url || resource.external_url || "",
        })),
      })),
    })),
  }));
}
