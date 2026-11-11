import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { validateInstitutionId } from "@/lib/institution-validation";
import { requireInstitutionAccess } from "./institution-access";

type Entity = "programs" | "courses" | "modules" | "lessons" | "lesson_resources" | "cohorts" | "enrollments" | "course_assignments";
type Scope = { tenantId: string; courseId?: string; cohortId?: string; statusIds: string[]; visibilityIds: string[] };

/** Resolve ownership from stored parents, never from a caller-supplied campus. */
export async function academicScope(entity: Entity, id: string): Promise<Scope> {
  validateInstitutionId(id);
  const client = await createClient();
  const delivery = ["cohorts", "enrollments", "course_assignments"].includes(entity);
  const { data, error } = await client.schema(delivery ? "delivery" : "academic").from(entity)
    .select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The selected item no longer exists.");
  if (entity === "enrollments" || entity === "course_assignments") return academicScope("cohorts", data.cohort_id);
  if (["lesson_resources", "lessons", "modules"].includes(entity)) {
    const parent = entity === "lesson_resources" ? await academicScope("lessons", data.lesson_id)
      : entity === "lessons" ? await academicScope("modules", data.module_id) : await academicScope("courses", data.course_id);
    if (parent.tenantId !== data.tenant_id || data.institution_id !== data.tenant_id) throw new Error("Invalid campus hierarchy.");
    return { ...parent, statusIds: [...parent.statusIds, ...(entity === "lesson_resources" ? [] : [data.status_id || "unpublished"])] };
  }
  if (entity === "courses" || entity === "cohorts") {
    const parent = await academicScope("programs", data.program_id);
    if (parent.tenantId !== data.tenant_id || data.institution_id !== data.tenant_id) throw new Error("Invalid campus hierarchy.");
    return { ...parent, ...(entity === "courses" ? { courseId: id } : { cohortId: id }),
      statusIds: [...parent.statusIds, ...(data.status_id ? [data.status_id] : [])],
      visibilityIds: [...parent.visibilityIds, ...(data.visibility_type_id ? [data.visibility_type_id] : [])] };
  }
  return { tenantId: data.tenant_id, statusIds: [data.status_id || "unpublished"], visibilityIds: data.visibility_type_id ? [data.visibility_type_id] : [] };
}

export async function requireAcademicWrite(entity: Entity, id: string, structureOnly = false) {
  const scope = await academicScope(entity, id);
  await requireCampusWrite(scope.tenantId, structureOnly, scope.courseId);
  return scope;
}

export async function requireCampusWrite(tenantId: string, structureOnly = true, courseId?: string) {
  validateInstitutionId(tenantId);
  const current = await getCurrentUser(true);
  if (!current?.user) throw new Error("Access denied.");
  const client = await createClient();
  const { data: campus, error } = await client.schema("institution").from("institutions")
    .select("id,status").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  if (!campus || campus.status !== "active") throw new Error("Campus is unavailable.");
  if (current.primaryRole === "super_admin") return current;
  if (current.primaryRole === "institution_admin" && current.tenantId === tenantId) return current;
  if (!structureOnly && courseId && ["teacher", "trainer"].includes(current.primaryRole)) {
    const [direct, cohorts] = await Promise.all([
      client.schema("academic").from("course_instructors").select("course_id").eq("course_id", courseId).eq("user_id", current.user.id),
      client.schema("delivery").from("cohort_teachers").select("cohort_id").eq("teacher_id", current.user.id),
    ]);
    if (direct.error || cohorts.error) throw new Error("Unable to verify instructor assignment.");
    if (direct.data?.length) return current;
    const ids = (cohorts.data || []).map(row => row.cohort_id);
    if (ids.length) {
      const assigned = await client.schema("delivery").from("course_assignments").select("id")
        .eq("course_id", courseId).in("cohort_id", ids).is("deleted_at", null).limit(1);
      if (assigned.error) throw assigned.error;
      if (assigned.data?.length) return current;
    }
  }
  throw new Error("Access denied.");
}

export async function deliveryCohortIds(tenantId: string) {
  const current = await requireInstitutionAccess(tenantId, true);
  const client = await createClient();
  let query = client.schema("delivery").from("cohorts").select("id").eq("tenant_id", tenantId).is("deleted_at", null);
  if (["teacher", "trainer"].includes(current.primaryRole)) {
    const { data, error } = await client.schema("delivery").from("cohort_teachers").select("cohort_id").eq("teacher_id", current.user.id);
    if (error) throw error;
    const ids = (data || []).map(row => row.cohort_id);
    if (!ids.length) return [];
    query = query.in("id", ids);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(row => row.id as string);
}

export async function requireCohortRead(cohortId: string) {
  const scope = await academicScope("cohorts", cohortId);
  if (!(await deliveryCohortIds(scope.tenantId)).includes(cohortId)) throw new Error("Access denied.");
}

export async function assignedCourseIds(userId: string, role: string) {
  const client = await createClient();
  const student = role === "student";
  let query = client.schema("delivery").from(student ? "enrollments" : "cohort_teachers")
    .select("cohort_id,cohort:cohort_id!inner(id,deleted_at,status_code)").eq(student ? "user_id" : "teacher_id", userId)
    .is("cohort.deleted_at", null);
  if (student) query = query.eq("status_code", "active").is("deleted_at", null).eq("cohort.status_code", "active");
  const { data, error } = await query;
  if (error) throw error;
  const cohortIds = (data || []).map(row => row.cohort_id);
  const [assignments, direct] = await Promise.all([
    cohortIds.length ? client.schema("delivery").from("course_assignments").select("course_id")
      .in("cohort_id", cohortIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    student ? Promise.resolve({ data: [], error: null }) : client.schema("academic").from("course_instructors")
      .select("course_id").eq("user_id", userId),
  ]);
  if (assignments.error || direct.error) throw new Error("Unable to load assigned courses.");
  return new Set([...(assignments.data || []), ...(direct.data || [])].map(row => row.course_id as string));
}

export async function requireAcademicRead(entity: Entity, id: string) {
  const scope = await academicScope(entity, id);
  const current = await requireInstitutionAccess(scope.tenantId);
  if (["super_admin", "institution_admin"].includes(current.primaryRole)) return current;
  if (scope.courseId && !(await assignedCourseIds(current.user.id, current.primaryRole)).has(scope.courseId)) throw new Error("Access denied.");
  if (current.primaryRole === "student") {
    const client = await createClient();
    const [active, privateVisibility] = await Promise.all([
      client.schema("academic").from("statuses").select("id").eq("code", "active").single(),
      client.schema("academic").from("visibility_types").select("id").eq("code", "private").single(),
    ]);
    if (active.error || privateVisibility.error) throw new Error("Unable to verify curriculum visibility.");
    if (scope.statusIds.some(id => id !== active.data.id) || scope.visibilityIds.includes(privateVisibility.data.id)) throw new Error("This curriculum is unavailable.");
  }
  return current;
}

export async function requireStudentRead(userId: string) {
  validateInstitutionId(userId);
  const caller = await getCurrentUser(true);
  if (!caller?.user) throw new Error("Access denied.");
  if (caller.user.id === userId || caller.primaryRole === "super_admin") return caller;
  const client = await createClient();
  const { data: student, error } = await client.schema("core").from("users").select("tenant_id").eq("id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!student?.tenant_id) throw new Error("Access denied.");
  const ids = await deliveryCohortIds(student.tenant_id);
  const assigned = ids.length ? await client.schema("delivery").from("enrollments").select("id").eq("user_id", userId)
    .in("cohort_id", ids).is("deleted_at", null).limit(1) : { data: [], error: null };
  if (assigned.error) throw assigned.error;
  if (!assigned.data?.length) throw new Error("Access denied.");
  return caller;
}
