import { createClient } from "@/utils/supabase/server";

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
  content_json?: any;
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
  
  const { data: courseTypes } = await supabase.schema("academic").from("course_types").select("*").order("code");
  const { data: lessonTypes } = await supabase.schema("academic").from("lesson_types").select("*").order("code");
  const { data: statuses } = await supabase.schema("academic").from("statuses").select("*").order("code");
  const { data: visibilityTypes } = await supabase.schema("academic").from("visibility_types").select("*").order("code");

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
  
  // Check auth user status
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("[Academic Service] supabase.auth.getUser() failed:", authError);
  } else {
    console.log("[Academic Service] supabase.auth.getUser() email:", authData?.user?.email, "ID:", authData?.user?.id);
  }

  // Call database function
  const { data, error } = await supabase.schema("core").rpc("get_current_user").maybeSingle();
  if (error) {
    console.error("[Academic Service] RPC 'get_current_user' failed:", error);
    throw new Error(`get_current_user RPC failed: ${error.message} (Code: ${error.code})`);
  }
  
  const cu = data as any;
  if (!cu) {
    console.warn("[Academic Service] RPC 'get_current_user' returned no database user mapping. Check if auth.users ID exists in core.users.");
  } else {
    console.log("[Academic Service] RPC 'get_current_user' mapped user successfully:", cu);
  }

  return cu ? { tenantId: cu.tenant_id, userId: cu.user_id, roles: cu.roles } : null;
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
    if (role === "super_admin") {
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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = input.tenant_id || session.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
  }

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
    .eq("id", id);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteProgram(id: string) {
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
    .eq("id", id);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { error } = await query;
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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = input.tenant_id || session.tenantId;
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
    .eq("id", id);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id: string) {
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
    .eq("id", id);

  if (session.tenantId) {
    query = query.eq("tenant_id", session.tenantId);
  }

  const { error } = await query;
  if (error) throw error;
  return true;
}

// Instructors Management
export async function getCourseInstructors(courseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("academic")
    .from("course_instructors")
    .select(`
      user_id,
      instructor_role,
      user:user_id(id, full_name, email)
    `)
    .eq("course_id", courseId);

  if (error) throw error;
  return data || [];
}

export async function assignCourseInstructors(courseId: string, instructorIds: string[]) {
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const { data: courseData } = await supabase
    .schema("academic")
    .from("courses")
    .select("tenant_id, institution_id")
    .eq("id", courseId)
    .single();

  const tenantId = courseData?.tenant_id || session.tenantId;
  const institutionId = courseData?.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Could not resolve tenant scope for course.");
  }

  await supabase
    .schema("academic")
    .from("course_instructors")
    .delete()
    .eq("course_id", courseId);

  if (instructorIds.length === 0) return true;

  const records = instructorIds.map((userId) => ({
    course_id: courseId,
    user_id: userId,
    instructor_role: "primary",
    tenant_id: tenantId,
    institution_id: institutionId
  }));

  const { error } = await supabase
    .schema("academic")
    .from("course_instructors")
    .insert(records);

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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = input.tenant_id || session.tenantId;
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
      position: input.position || 1,
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
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModule(id: string) {
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
    .eq("id", id);

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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const tenantId = input.tenant_id || session.tenantId;
  const institutionId = input.institution_id || tenantId;

  if (!tenantId || !institutionId) {
    throw new Error("Tenant ID and Institution ID are required.");
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
      position: input.position || 1,
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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

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
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLesson(id: string) {
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
    .eq("id", id);

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
  return (data || []).map((res: any) => ({
    ...res,
    resource_type: res.resource_type_code,
    file_url: res.resource_type_code === "file" ? res.resource_url : undefined,
    external_url: res.resource_type_code !== "file" ? res.resource_url : undefined
  }));
}

export async function createLessonResource(input: LessonResourceInput) {
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session");

  const tenantId = input.tenant_id || session.tenantId;
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
      position: input.position || 1,
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
  const supabase = await createClient();
  const { error } = await supabase
    .schema("academic")
    .from("lesson_resources")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id);

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
    .is("deleted_at", null);

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
    .order("position", { ascending: true });

  if (lesError) throw lesError;
  return lessons || [];
}


