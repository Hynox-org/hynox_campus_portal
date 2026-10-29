import { createClient } from "@/utils/supabase/server";
import { requireAcademicWrite, requireCampusWrite } from "./academic-access";
import { validateAcademicInput, validateAssignmentIds } from "@/lib/academic-validation";

export interface ProgramInput {
  title: string;
  slug: string;
  description?: string;
  status_id?: string;
  visibility_type_id?: string;
  tenant_id?: string;
  institution_id?: string;
}

export interface CourseInput {
  program_id: string;
  title: string;
  slug: string;
  description?: string;
  course_type_id?: string;
  status_id?: string;
  visibility_type_id?: string;
  enrollment_mode?: "open" | "approval" | "private" | "institution_only";
  duration_minutes?: number;
  thumbnail_path?: string;
  tenant_id?: string;
  institution_id?: string;
}

export interface ModuleInput {
  course_id: string;
  title: string;
  description?: string;
  position?: number;
  status_id?: string;
  tenant_id?: string;
  institution_id?: string;
}

export interface LessonInput {
  module_id: string;
  title: string;
  lesson_type_id?: string;
  content_json?: unknown;
  video_url?: string;
  duration?: number;
  position?: number;
  is_preview?: boolean;
  status_id?: string;
  tenant_id?: string;
  institution_id?: string;
}

export interface LessonResourceInput {
  lesson_id: string;
  resource_type: string;
  title: string;
  file_url?: string;
  external_url?: string;
  position?: number;
  tenant_id?: string;
  institution_id?: string;
}

export async function getAcademicLookups() {
  const supabase = await createClient();
  
  const results = await Promise.all([
    supabase.schema("academic").from("course_types").select("*").order("code"),
    supabase.schema("academic").from("lesson_types").select("*").order("code"),
    supabase.schema("academic").from("statuses").select("*").order("code"),
    supabase.schema("academic").from("visibility_types").select("*").order("code"),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const [courseTypes, lessonTypes, statuses, visibilityTypes] = results.map(result => result.data);

  return {
    courseTypes: courseTypes || [],
    lessonTypes: lessonTypes || [],
    statuses: statuses || [],
    visibilityTypes: visibilityTypes || []
  };
}

// User-tenant helper
export async function getSessionTenant() {
  const supabase = await createClient();
  
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;
  const { data, error } = await supabase.schema("core").rpc("get_current_user").maybeSingle();
  if (error) throw error;
  const cu = data as { tenant_id: string | null; user_id: string; roles: string[]; status: string } | null;
  return cu && cu.status === "active" ? { tenantId: cu.tenant_id, userId: cu.user_id, roles: cu.roles } : null;
}

// List all teachers/trainers for instructor selection
export async function listTenantInstructors(tenantId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .rpc("get_tenant_teachers", { p_tenant_id: tenantId });

  if (error) {
    console.error("Error fetching instructors via RPC:", error);
    return [];
  }

  return data || [];
}

// ----------------------------------------------------
// Programs CRUD
// ----------------------------------------------------
export async function listPrograms(tenantId: string, userRoleOrFilterActiveOnly?: string | boolean) {
  const supabase = await createClient();
  let query = supabase
    .schema("academic")
    .from("programs")
    .select(`
      *,
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  let role: string | undefined = undefined;
  let activeOnly = false;

  if (typeof userRoleOrFilterActiveOnly === "string") {
    role = userRoleOrFilterActiveOnly;
  } else if (typeof userRoleOrFilterActiveOnly === "boolean") {
    activeOnly = userRoleOrFilterActiveOnly;
  }

  if (role) {
    if (role === "super_admin" || role === "institution_admin") {
      // Super admin sees all, no status filters
    } else if (role === "teacher" || role === "trainer") {
      // Teachers and trainers see active and draft programs
      const { data: statuses } = await supabase
        .schema("academic")
        .from("statuses")
        .select("id")
        .in("code", ["active", "draft"]);
      if (statuses && statuses.length > 0) {
        query = query.in("status_id", statuses.map(s => s.id));
      }
    } else {
      // Everyone else (students, institution_admin, etc.) sees only active programs
      const { data: activeStatus } = await supabase
        .schema("academic")
        .from("statuses")
        .select("id")
        .eq("code", "active")
        .single();
      if (activeStatus) {
        query = query.eq("status_id", activeStatus.id);
      }
    }
  } else if (activeOnly) {
    const { data: activeStatus } = await supabase
      .schema("academic")
      .from("statuses")
      .select("id")
      .eq("code", "active")
      .single();
    if (activeStatus) {
      query = query.eq("status_id", activeStatus.id);
    }
  }

  const { data, error } = await query.order("title");
  if (error) throw error;
  return data || [];
}

export async function getProgram(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("programs")
    .select(`
      *,
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function createProgram(input: ProgramInput) {
  input = validateAcademicInput(input, ['title', 'slug']) as typeof input;
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = input.tenant_id || session.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
  }

  await requireCampusWrite(tenantId);
  if (institutionId !== tenantId) throw new Error("Invalid campus hierarchy.");

  const { data, error } = await supabase
    .schema("academic")
    .from("programs")
    .insert({
      tenant_id: tenantId,
      institution_id: institutionId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      status_id: input.status_id,
      visibility_type_id: input.visibility_type_id,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProgram(id: string, input: Partial<ProgramInput>) {
  input = validateAcademicInput(input, []) as typeof input;
  await requireAcademicWrite("programs", id, true);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  let query = supabase
    .schema("academic")
    .from("programs")
    .update({
      title: input.title,
      slug: input.slug,
      description: input.description,
      status_id: input.status_id,
      visibility_type_id: input.visibility_type_id,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteProgram(id: string) {
  await requireAcademicWrite("programs", id, true);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  let query = supabase
    .schema("academic")
    .from("programs")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id).is("deleted_at", null);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { error } = await query.select("id").single();
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Courses CRUD
// ----------------------------------------------------
export async function listCourses(programId: string, filterActiveOnly = false) {
  const supabase = await createClient();
  let query = supabase
    .schema("academic")
    .from("courses")
    .select(`
      *,
      course_type:course_type_id(code, description),
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("program_id", programId)
    .is("deleted_at", null);

  if (filterActiveOnly) {
    const { data: activeStatus } = await supabase.schema("academic").from("statuses").select("id").eq("code", "active").single();
    if (activeStatus) {
      query = query.eq("status_id", activeStatus.id);
    }
  }

  const { data, error } = await query.order("title");
  if (error) throw error;
  return data || [];
}

export async function getCourse(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("courses")
    .select(`
      *,
      course_type:course_type_id(code, description),
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data;
}

export async function createCourse(input: CourseInput) {
  input = validateAcademicInput(input, ['program_id', 'title', 'slug']) as typeof input;
  const scope = await requireAcademicWrite("programs", input.program_id, true);
  if ((input.tenant_id && input.tenant_id !== scope.tenantId) || (input.institution_id && input.institution_id !== scope.tenantId)) throw new Error("Invalid campus hierarchy.");
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = scope.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
  }

  const { data, error } = await supabase
    .schema("academic")
    .from("courses")
    .insert({
      program_id: input.program_id,
      tenant_id: tenantId,
      institution_id: institutionId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      course_type_id: input.course_type_id,
      status_id: input.status_id,
      visibility_type_id: input.visibility_type_id,
      enrollment_mode: input.enrollment_mode || "open",
      duration_minutes: input.duration_minutes,
      thumbnail_path: input.thumbnail_path,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCourse(id: string, input: Partial<CourseInput>) {
  input = validateAcademicInput(input, []) as typeof input;
  await requireAcademicWrite("courses", id, true);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  let query = supabase
    .schema("academic")
    .from("courses")
    .update({
      title: input.title,
      slug: input.slug,
      description: input.description,
      course_type_id: input.course_type_id,
      status_id: input.status_id,
      visibility_type_id: input.visibility_type_id,
      enrollment_mode: input.enrollment_mode,
      duration_minutes: input.duration_minutes,
      thumbnail_path: input.thumbnail_path,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id: string) {
  await requireAcademicWrite("courses", id, true);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  let query = supabase
    .schema("academic")
    .from("courses")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id).is("deleted_at", null);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { error } = await query.select("id").single();
  if (error) throw error;
  return true;
}

// Instructors Management
export async function getCourseInstructors(courseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("course_instructors")
    .select("user_id, instructor_role")
    .eq("course_id", courseId);

  if (error) throw error;
  if (!data?.length) return [];

  // PostgREST cannot embed this relationship across the academic and core schemas.
  const { data: users, error: usersError } = await supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", [...new Set(data.map(instructor => instructor.user_id))]);
  if (usersError) throw usersError;
  const usersById = new Map((users || []).map(user => [user.id, user]));
  return data.map(instructor => ({ ...instructor, user: usersById.get(instructor.user_id) || null }));
}

export async function assignCourseInstructors(courseId: string, instructorIds: string[]) {
  validateAssignmentIds(courseId, instructorIds);
  await requireAcademicWrite("courses", courseId, true);
  const supabase = await createClient();
  const { error } = await supabase.schema("academic").rpc("replace_course_instructors", {
    p_course_id: courseId, p_instructor_ids: instructorIds,
  });
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Modules CRUD
// ----------------------------------------------------
export async function listModules(courseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("modules")
    .select(`
      *,
      status:status_id(code, description)
    `)
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createModule(input: ModuleInput) {
  input = validateAcademicInput(input, ['course_id', 'title']) as typeof input;
  const scope = await requireAcademicWrite("courses", input.course_id, false);
  if ((input.tenant_id && input.tenant_id !== scope.tenantId) || (input.institution_id && input.institution_id !== scope.tenantId)) throw new Error("Invalid campus hierarchy.");
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = scope.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
  }

  const { data, error } = await supabase
    .schema("academic")
    .from("modules")
    .insert({
      course_id: input.course_id,
      tenant_id: tenantId,
      institution_id: institutionId,
      title: input.title,
      description: input.description,
      position: input.position ?? 1,
      status_id: input.status_id,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateModule(id: string, input: Partial<ModuleInput>) {
  input = validateAcademicInput(input, []) as typeof input;
  await requireAcademicWrite("modules", id, false);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const { data, error } = await supabase
    .schema("academic")
    .from("modules")
    .update({
      title: input.title,
      description: input.description,
      position: input.position,
      status_id: input.status_id,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModule(id: string) {
  await requireAcademicWrite("modules", id, false);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const { error } = await supabase
    .schema("academic")
    .from("modules")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id).is("deleted_at", null).select("id").single();

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Lessons CRUD
// ----------------------------------------------------
export async function listLessons(moduleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("lessons")
    .select(`
      *,
      lesson_type:lesson_type_id(code, description),
      status:status_id(code, description)
    `)
    .eq("module_id", moduleId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLesson(input: LessonInput) {
  input = validateAcademicInput(input, ['module_id', 'title']) as typeof input;
  const scope = await requireAcademicWrite("modules", input.module_id, false);
  if ((input.tenant_id && input.tenant_id !== scope.tenantId) || (input.institution_id && input.institution_id !== scope.tenantId)) throw new Error("Invalid campus hierarchy.");
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const tenantId = scope.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
  }

  if (input.lesson_type_id) {
    const { data: typeObj } = await supabase
      .schema("academic")
      .from("lesson_types")
      .select("code")
      .eq("id", input.lesson_type_id)
      .maybeSingle();

    const code = (typeObj?.code || "").toLowerCase();
    if (code === "assignment" || code === "assessment") {
      throw new Error("Assessment and assignment type lessons cannot be added inside a course syllabus.");
    }
  }

  const { data, error } = await supabase
    .schema("academic")
    .from("lessons")
    .insert({
      module_id: input.module_id,
      tenant_id: tenantId,
      institution_id: institutionId,
      title: input.title,
      lesson_type_id: input.lesson_type_id,
      content_json: input.content_json || {},
      video_url: input.video_url,
      duration: input.duration,
      position: input.position ?? 1,
      is_preview: input.is_preview || false,
      status_id: input.status_id,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLesson(id: string, input: Partial<LessonInput>) {
  input = validateAcademicInput(input, []) as typeof input;
  await requireAcademicWrite("lessons", id, false);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  if (input.lesson_type_id) {
    const { data: typeObj } = await supabase
      .schema("academic")
      .from("lesson_types")
      .select("code")
      .eq("id", input.lesson_type_id)
      .maybeSingle();

    const code = (typeObj?.code || "").toLowerCase();
    if (code === "assignment" || code === "assessment") {
      throw new Error("Assessment and assignment type lessons cannot be added inside a course syllabus.");
    }
  }

  const { data, error } = await supabase
    .schema("academic")
    .from("lessons")
    .update({
      title: input.title,
      lesson_type_id: input.lesson_type_id,
      content_json: input.content_json,
      video_url: input.video_url,
      duration: input.duration,
      position: input.position,
      is_preview: input.is_preview,
      status_id: input.status_id,
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLesson(id: string) {
  await requireAcademicWrite("lessons", id, false);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const { error } = await supabase
    .schema("academic")
    .from("lessons")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq("id", id).is("deleted_at", null).select("id").single();

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Resources CRUD
// ----------------------------------------------------
export async function listLessonResources(lessonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("lesson_resources")
    .select("*")
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data || []).map((res) => ({
    ...res,
    resource_type: res.resource_type_code,
    file_url: res.resource_type_code === "file" ? res.resource_url : undefined,
    external_url: res.resource_type_code !== "file" ? res.resource_url : undefined
  }));
}

export async function createLessonResource(input: LessonResourceInput) {
  input = validateAcademicInput(input, ['lesson_id', 'title', 'resource_type']) as typeof input;
  const scope = await requireAcademicWrite("lessons", input.lesson_id, false);
  if ((input.tenant_id && input.tenant_id !== scope.tenantId) || (input.institution_id && input.institution_id !== scope.tenantId)) throw new Error("Invalid campus hierarchy.");
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const tenantId = scope.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
  }

  const { data, error } = await supabase
    .schema("academic")
    .from("lesson_resources")
    .insert({
      lesson_id: input.lesson_id,
      tenant_id: tenantId,
      institution_id: institutionId,
      resource_type_code: input.resource_type,
      resource_url: input.file_url || input.external_url || "",
      title: input.title,
      position: input.position ?? 1,
      created_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    resource_type: data.resource_type_code,
    file_url: data.resource_type_code === "file" ? data.resource_url : undefined,
    external_url: data.resource_type_code !== "file" ? data.resource_url : undefined
  };
}

export async function deleteLessonResource(id: string) {
  await requireAcademicWrite("lesson_resources", id, false);
  const supabase = await createClient();
  const { error } = await supabase
    .schema("academic")
    .from("lesson_resources")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null).select("id").single();

  if (error) throw error;
  return true;
}

export async function getProgramBySlug(slug: string, tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("programs")
    .select(`
      *,
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("slug", slug)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCourseBySlug(slug: string, tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("courses")
    .select(`
      *,
      course_type:course_type_id(code, description),
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("slug", slug)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listTenantCourses(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("courses")
    .select(`
      *,
      course_type:course_type_id(code, description),
      status:status_id(code, description),
      visibility:visibility_type_id(code, description)
    `)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("title");

  if (error) throw error;
  return data || [];
}

export async function listLessonsForCourse(courseId: string) {
  const supabase = await createClient();
  const { data: modules, error: modError } = await supabase
    .schema("academic")
    .from("modules")
    .select("id")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .order("position", { ascending: true }).order("id", { ascending: true });

  if (modError) throw modError;
  if (!modules || modules.length === 0) return [];

  const moduleIds = modules.map(m => m.id);

  const { data: lessons, error: lesError } = await supabase
    .schema("academic")
    .from("lessons")
    .select(`
      *,
      lesson_type:lesson_type_id(code, description),
      status:status_id(code, description)
    `)
    .in("module_id", moduleIds)
    .is("deleted_at", null)
    .order("position", { ascending: true }).order("id", { ascending: true });

  if (lesError) throw lesError;
  const moduleOrder = new Map(moduleIds.map((id, index) => [id, index]));
  return (lessons || []).sort((left, right) =>
    (moduleOrder.get(left.module_id) ?? 0) - (moduleOrder.get(right.module_id) ?? 0)
  );
}


