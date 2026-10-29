import { averageLearningProgress } from "@/lib/learning-progress";
import { readProgressSnapshots, refreshProgressSnapshot, setLessonProgress } from "./course-progress";
import type { Program, Institution, CampusUser, Course } from "@/types/campus";
import type { Cohort } from "@/types/campus";
import { getCurrentUser } from "./auth";
import { validateInstitutionId } from "@/lib/institution-validation";
import { createClient } from "@/utils/supabase/server";
import { getSessionTenant } from "./academic";
import { academicScope, requireAcademicWrite, deliveryCohortIds, requireCohortRead, requireStudentRead } from "./academic-access";
import { validateAcademicInput, validateAssignmentIds } from "@/lib/academic-validation";

// ----------------------------------------------------
// Lookups
// ----------------------------------------------------
export async function getDeliveryLookups() {
  const supabase = await createClient();
  const { data: cohortStatuses } = await supabase.schema("delivery").from("cohort_statuses").select("*").order("code");
  const { data: enrollmentStatuses } = await supabase.schema("delivery").from("enrollment_statuses").select("*").order("code");
  const { data: progressStatuses } = await supabase.schema("delivery").from("progress_statuses").select("*").order("code");

  return {
    cohortStatuses: cohortStatuses || [],
    enrollmentStatuses: enrollmentStatuses || [],
    progressStatuses: progressStatuses || []
  };
}

// ----------------------------------------------------
// Cohorts CRUD
// ----------------------------------------------------
export interface CohortInput {
  tenant_id?: string;
  institution_id?: string;
  program_id: string;
  name: string;
  code: string;
  start_date?: string;
  end_date?: string;
  status_code: string;
}

export async function listCohorts(tenantId: string) {
  const allowedCohorts = await deliveryCohortIds(tenantId);
  if (!allowedCohorts.length) return [];
  const supabase = await createClient();
  const { data: cohorts, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", allowedCohorts)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!cohorts || cohorts.length === 0) return [];

  // Fetch programs manually (cross-schema)
  const programIds = [...new Set(cohorts.map(c => c.program_id).filter(Boolean))];
  let programs: Program[] = [];
  if (programIds.length > 0) {
    const { data: progData } = await supabase
      .schema("academic")
      .from("programs")
      .select("id, title")
      .in("id", programIds);
    programs = progData || [];
  }

  // Fetch institutions manually (cross-schema)
  const instIds = [...new Set(cohorts.map(c => c.institution_id).filter(Boolean))];
  let institutions: Institution[] = [];
  if (instIds.length > 0) {
    const { data: instData } = await supabase
      .schema("institution")
      .from("institutions")
      .select("id, name")
      .in("id", instIds);
    institutions = instData || [];
  }

  return cohorts.map(cohort => ({
    ...cohort,
    program: programs.find(p => p.id === cohort.program_id) || null,
    institution: institutions.find(i => i.id === cohort.institution_id) || null
  }));
}

export async function createCohort(input: CohortInput) {
  input = validateAcademicInput(input, ["name", "code", "program_id", "status_code"]) as typeof input;
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
    .schema("delivery")
    .from("cohorts")
    .insert({
      tenant_id: tenantId,
      institution_id: institutionId,
      program_id: input.program_id,
      name: input.name,
      code: input.code,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status_code: input.status_code,
      created_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCohort(id: string, input: Partial<CohortInput>) {
  input = validateAcademicInput(input) as typeof input;
  await requireAcademicWrite("cohorts", id, true);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const { data, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .update({
      name: input.name,
      code: input.code,
      start_date: input.start_date === "" ? null : input.start_date,
      end_date: input.end_date === "" ? null : input.end_date,
      status_code: input.status_code,
      updated_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCohort(id: string) {
  await requireAcademicWrite("cohorts", id, true);
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null).select("id").single();

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Enrollments CRUD
// ----------------------------------------------------
export interface EnrollmentInput {
  user_id: string;
  cohort_id: string;
  status_code: string;
}

export async function listEnrollments(tenantId: string) {
  const allowedCohorts = await deliveryCohortIds(tenantId);
  if (!allowedCohorts.length) return [];
  const supabase = await createClient();
  const { data: enrollments, error } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select(`
      *,
      cohort:cohort_id!inner (
        id, 
        name, 
        code, 
        tenant_id
      )
    `)
    .eq("cohort.tenant_id", tenantId)
    .in("cohort_id", allowedCohorts)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!enrollments) return [];
  
  // Filter enrollments belonging to the user's institution
  const filtered = enrollments.filter((e) => e.cohort?.tenant_id === tenantId);
  if (filtered.length === 0) return [];

  // Fetch student details from core.users (cross-schema)
  const studentIds = [...new Set(filtered.map((e) => e.user_id).filter(Boolean))];
  const [userResult, assignmentResult] = await Promise.all([
    supabase.schema("core").from("users").select("id, full_name, email").in("id", studentIds),
    supabase.schema("delivery").from("course_assignments").select("*").in("cohort_id", [...new Set(filtered.map(enrollment => enrollment.cohort_id))]).is("deleted_at", null),
  ]);
  if (userResult.error) throw userResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  const students: CampusUser[] = userResult.data || [];
  const assignments = assignmentResult.data || [];

  const progressRecords = await readProgressSnapshots(studentIds, assignments.map(assignment => assignment.course_id), supabase);

  return filtered.map((e) => {
    const student = students.find(s => s.id === e.user_id) || null;
    
    // Find course assignments for this cohort
    const cohortAssignments = assignments.filter(a => a.cohort_id === e.cohort_id);
    const assignedCourseIds = cohortAssignments.map(a => a.course_id);
    
    // Find student course progress for these courses
    const studentProgress = progressRecords.filter(p => p.user_id === e.user_id && assignedCourseIds.includes(p.course_id));
    
    const avgProgress = averageLearningProgress(studentProgress.map(progress => progress.progress_percentage));

    return {
      ...e,
      student,
      progress_percentage: avgProgress
    };
  });
}

export async function enrollStudent(input: EnrollmentInput) {
  input = validateAcademicInput(input, ["user_id", "cohort_id", "status_code"]) as typeof input;
  await requireAcademicWrite("cohorts", input.cohort_id, true);
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  // Get current cohort details
  const { data: currentCohort, error: ccError } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("program_id, name, start_date, end_date, status_code")
    .eq("id", input.cohort_id)
    .single();

  if (ccError || !currentCohort) throw new Error("Cohort not found.");

  const isCohortActive = (cohort: Pick<Cohort, "status_code" | "end_date">) => {
    if (cohort.status_code !== "active") return false;
    const now = new Date();
    if (cohort.end_date && new Date(cohort.end_date) < now) return false;
    return true;
  };

  if (input.status_code === "active" && isCohortActive(currentCohort)) {
    // Check if student has active enrollment in another active cohort of this program
    const { data: existingEnrollments, error: eeError } = await supabase
      .schema("delivery")
      .from("enrollments")
      .select(`
        id,
        status_code,
        cohort:cohort_id (
          id,
          name,
          program_id,
          status_code,
          start_date,
          end_date
        )
      `)
      .eq("user_id", input.user_id)
      .eq("status_code", "active")
      .is("deleted_at", null);

    if (eeError) throw eeError;

    for (const enroll of (existingEnrollments || [])) {
      const cohort = (Array.isArray(enroll.cohort) ? enroll.cohort[0] : enroll.cohort);
      if (cohort && cohort.program_id === currentCohort.program_id && isCohortActive(cohort)) {
        throw new Error(`Student is already active in another active cohort "${cohort.name}" of this program.`);
      }
    }
  }

  const { data, error } = await supabase
    .schema("delivery")
    .from("enrollments")
    .insert({
      user_id: input.user_id,
      cohort_id: input.cohort_id,
      status_code: input.status_code,
      created_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEnrollmentStatus(id: string, status_code: string) {
  validateAcademicInput({ status_code }, ["status_code"]);
  await requireAcademicWrite("enrollments", id, true);
  const supabase = await createClient();

  const isCohortActive = (cohort: Cohort) => {
    if (cohort.status_code !== "active") return false;
    const now = new Date();
    if (cohort.end_date && new Date(cohort.end_date) < now) return false;
    return true;
  };

  if (status_code === "active") {
    // Get the current enrollment details
    const { data: currentEnroll, error: ceError } = await supabase
      .schema("delivery")
      .from("enrollments")
      .select(`
        user_id,
        cohort:cohort_id (
          id,
          name,
          program_id,
          status_code,
          start_date,
          end_date
        )
      `)
      .eq("id", id).is("deleted_at", null)
      .single();

    if (ceError || !currentEnroll) throw new Error("Enrollment not found.");

    const currentCohort = (Array.isArray(currentEnroll.cohort) ? currentEnroll.cohort[0] : currentEnroll.cohort);
    if (currentCohort && isCohortActive(currentCohort)) {
      // Check if student has active enrollment in another active cohort of this program
      const { data: existingEnrollments, error: eeError } = await supabase
        .schema("delivery")
        .from("enrollments")
        .select(`
          id,
          status_code,
          cohort:cohort_id (
            id,
            name,
            program_id,
            status_code,
            start_date,
            end_date
          )
        `)
        .eq("user_id", currentEnroll.user_id)
        .eq("status_code", "active")
        .neq("id", id) // exclude this enrollment itself
        .is("deleted_at", null);

      if (eeError) throw eeError;

      for (const enroll of (existingEnrollments || [])) {
        const cohort = (Array.isArray(enroll.cohort) ? enroll.cohort[0] : enroll.cohort);
        if (cohort && cohort.program_id === currentCohort.program_id && isCohortActive(cohort)) {
          throw new Error(`Student is already active in another active cohort "${cohort.name}" of this program.`);
        }
      }
    }
  }

  const { data, error } = await supabase
    .schema("delivery")
    .from("enrollments")
    .update({
      status_code,
      updated_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeEnrollment(id: string) {
  await requireAcademicWrite("enrollments", id, true);
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("enrollments")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null).select("id").single();

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Course Assignments CRUD
// ----------------------------------------------------
export interface CourseAssignmentInput {
  cohort_id: string;
  course_id: string;
  start_date?: string;
  due_date?: string;
  is_required?: boolean;
}

export async function listCourseAssignments(tenantId: string) {
  const allowedCohorts = await deliveryCohortIds(tenantId);
  if (!allowedCohorts.length) return [];
  const supabase = await createClient();
  const { data: assignments, error } = await supabase
    .schema("delivery")
    .from("course_assignments")
    .select(`
      *,
      cohort:cohort_id!inner (
        id, 
        name, 
        code,
        tenant_id
      )
    `)
    .eq("cohort.tenant_id", tenantId)
    .in("cohort_id", allowedCohorts)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!assignments) return [];

  // Filter assignments belonging to the user's institution
  const filtered = assignments.filter((a) => a.cohort?.tenant_id === tenantId);
  if (filtered.length === 0) return [];

  // Fetch courses from academic.courses (cross-schema)
  const courseIds = [...new Set(filtered.map((a) => a.course_id).filter(Boolean))];
  let courses: Course[] = [];
  if (courseIds.length > 0) {
    const { data: courseData } = await supabase
      .schema("academic")
      .from("courses")
      .select("id, title, description")
      .in("id", courseIds);
    courses = courseData || [];
  }

  return filtered.map((a) => ({
    ...a,
    course: courses.find(c => c.id === a.course_id) || null
  }));
}

export async function assignCourse(input: CourseAssignmentInput) {
  input = validateAcademicInput(input, ["cohort_id", "course_id"]) as typeof input;
  const cohortScope = await requireAcademicWrite("cohorts", input.cohort_id, true);
  const courseScope = await academicScope("courses", input.course_id);
  if (cohortScope.tenantId !== courseScope.tenantId) throw new Error("Course and cohort must belong to the same campus.");
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  // Fetch cohort dates
  const { data: cohort, error: cohortError } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("start_date, end_date, name")
    .eq("id", input.cohort_id)
    .maybeSingle();

  if (cohortError || !cohort) {
    throw new Error(`Cohort not found: ${cohortError?.message || "Match not found for cohort ID."}`);
  }

  const cohortStart = cohort.start_date ? new Date(cohort.start_date) : null;
  const cohortEnd = cohort.end_date ? new Date(cohort.end_date) : null;

  if (input.start_date) {
    const assignStart = new Date(input.start_date);
    if (cohortStart && assignStart < cohortStart) {
      throw new Error(`Course assignment start date cannot be before cohort start date (${cohort.start_date.split('T')[0]}).`);
    }
    if (cohortEnd && assignStart > cohortEnd) {
      throw new Error(`Course assignment start date cannot be after cohort end date (${cohort.end_date.split('T')[0]}).`);
    }
  }

  if (input.due_date) {
    const assignDue = new Date(input.due_date);
    if (cohortStart && assignDue < cohortStart) {
      throw new Error(`Course assignment due date cannot be before cohort start date (${cohort.start_date.split('T')[0]}).`);
    }
    if (cohortEnd && assignDue > cohortEnd) {
      throw new Error(`Course assignment due date cannot be after cohort end date (${cohort.end_date.split('T')[0]}).`);
    }
  }

  if (input.start_date && input.due_date) {
    const assignStart = new Date(input.start_date);
    const assignDue = new Date(input.due_date);
    if (assignStart > assignDue) {
      throw new Error("Course assignment start date cannot be after due date.");
    }
  }

  const { data, error } = await supabase
    .schema("delivery")
    .from("course_assignments")
    .insert({
      cohort_id: input.cohort_id,
      course_id: input.course_id,
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      is_required: input.is_required !== undefined ? input.is_required : true,
      created_by: session.userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeCourseAssignment(id: string) {
  await requireAcademicWrite("course_assignments", id, true);
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("course_assignments")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id).is("deleted_at", null).select("id").single();

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Student Dashboard / Learning Progress Operations
// ----------------------------------------------------
export async function getStudentDeliveryData(userId: string) {
  validateInstitutionId(userId);
  const caller = await getCurrentUser(true);
  if (!caller?.user) throw new Error("Access denied.");
  const supabase = await createClient();
  let allowedCohorts: string[] | undefined;
  if (caller.user.id !== userId && caller.primaryRole !== "super_admin") {
    const { data: student, error } = await supabase.schema("core").from("users").select("tenant_id")
      .eq("id", userId).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!student?.tenant_id) throw new Error("Access denied.");
    allowedCohorts = await deliveryCohortIds(student.tenant_id);
  }
  let enrollmentQuery = supabase.schema("delivery").from("enrollments")
    .select("cohort:cohort_id!inner(id,name,code,program_id,tenant_id,status_code,deleted_at)")
    .eq("user_id", userId).eq("status_code", "active").is("deleted_at", null)
    .eq("cohort.status_code", "active").is("cohort.deleted_at", null);
  if (allowedCohorts) {
    if (!allowedCohorts.length) return [];
    enrollmentQuery = enrollmentQuery.in("cohort_id", allowedCohorts);
  }
  const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
  if (enrollmentError) throw enrollmentError;
  const cohorts = (enrollments || []).map(row => row.cohort as unknown as { id: string; name: string; code: string; program_id: string });
  if (!cohorts.length) return [];
  const [programResult, assignmentResult] = await Promise.all([
    supabase.schema("academic").from("programs").select("*,status:status_id(code),visibility:visibility_type_id(code)")
      .in("id", [...new Set(cohorts.map(row => row.program_id))]).is("deleted_at", null),
    supabase.schema("delivery").from("course_assignments").select("*").in("cohort_id", cohorts.map(row => row.id)).is("deleted_at", null),
  ]);
  if (programResult.error || assignmentResult.error) throw new Error("Unable to load assigned programs and courses.");
  const assignments = assignmentResult.data || [];
  const courseIds = [...new Set(assignments.map(row => row.course_id))];
  const [courseResult, progressResult] = courseIds.length ? await Promise.all([
    supabase.schema("academic").from("courses").select("*,status:status_id(code),visibility:visibility_type_id(code),course_type:course_type_id(code)")
      .in("id", courseIds).is("deleted_at", null),
    readProgressSnapshots([userId], courseIds, supabase).then(data => ({ data, error: null })),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (courseResult.error || progressResult.error) throw new Error("Unable to load courses and progress.");
  const courses = new Map((courseResult.data || []).filter(course => course.status?.code === "active" && course.visibility?.code !== "private")
    .map(course => [course.id, course]));
  const progress = new Map((progressResult.data || []).map(row => [row.course_id, row]));
  return (programResult.data || []).filter(program => program.status?.code === "active" && program.visibility?.code !== "private").map(program => {
    const groups = cohorts.filter(cohort => cohort.program_id === program.id);
    const groupIds = new Set(groups.map(cohort => cohort.id));
    return {
      id: program.id, title: program.title, description: program.description, status_code: "active", cohorts: groups,
      courses: assignments.filter(assignment => groupIds.has(assignment.cohort_id)).flatMap(assignment => {
        const course = courses.get(assignment.course_id);
        if (!course || course.program_id !== program.id) return [];
        return [{ id: course.id, title: course.title, description: course.description, duration_minutes: course.duration_minutes,
          course_type: course.course_type?.code || "theory", isRequired: assignment.is_required, startDate: assignment.start_date,
          dueDate: assignment.due_date, cohort_id: assignment.cohort_id,
          progress: progress.get(course.id) || { user_id: userId, course_id: course.id, completed_lessons: 0, total_lessons: 0, completed_activities: 0, total_activities: 0, progress_percentage: 0, status_code: "not_started" } }];
      }),
    };
  });
}

export async function getLessonProgress(userId: string, lessonId: string) {
  await requireStudentRead(userId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("delivery")
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function startOrUpdateLessonProgress(userId: string, lessonId: string, courseId: string) {
  const caller = await requireStudentRead(userId);
  if (caller.primaryRole !== "student" || caller.user.id !== userId) throw new Error("Only the student may update their lesson progress.");
  validateInstitutionId(lessonId); validateInstitutionId(courseId);
  return setLessonProgress(userId, lessonId, courseId, false);
}

export async function completeLessonProgress(userId: string, lessonId: string, courseId: string) {
  const caller = await requireStudentRead(userId);
  if (caller.primaryRole !== "student" || caller.user.id !== userId) throw new Error("Only the student may update their lesson progress.");
  validateInstitutionId(lessonId); validateInstitutionId(courseId);
  return setLessonProgress(userId, lessonId, courseId, true);
}

export async function syncCourseProgress(userId: string, courseId: string) {
  await requireStudentRead(userId);
  return refreshProgressSnapshot(userId, courseId);
}

export async function listStudentLessonProgress(userId: string) {
  await requireStudentRead(userId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("delivery")
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId);
    
  if (error) throw error;
  return data || [];
}

export async function listTeacherCohorts(teacherId: string, isSuperAdmin: boolean = false) {
  validateInstitutionId(teacherId);
  const caller = await getCurrentUser(true);
  if (!caller?.user || (caller.primaryRole !== "super_admin" && caller.user.id !== teacherId)) throw new Error("Access denied.");
  isSuperAdmin = isSuperAdmin && caller.primaryRole === "super_admin";
  const supabase = await createClient();

  if (isSuperAdmin) {
    const { data: cohorts, error } = await supabase
      .schema("delivery")
      .from("cohorts")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!cohorts || cohorts.length === 0) return [];

    const programIds = [...new Set(cohorts.map(c => c.program_id).filter(Boolean))];
    let programs: Program[] = [];
    if (programIds.length > 0) {
      const { data: progData } = await supabase
        .schema("academic")
        .from("programs")
        .select("id, title")
        .in("id", programIds);
      programs = progData || [];
    }

    const instIds = [...new Set(cohorts.map(c => c.institution_id).filter(Boolean))];
    let institutions: Institution[] = [];
    if (instIds.length > 0) {
      const { data: instData } = await supabase
        .schema("institution")
        .from("institutions")
        .select("id, name")
        .in("id", instIds);
      institutions = instData || [];
    }

    return cohorts.map(cohort => ({
      ...cohort,
      program: programs.find(p => p.id === cohort.program_id) || null,
      institution: institutions.find(i => i.id === cohort.institution_id) || null
    }));
  }

  const { data: mappings, error: mapError } = await supabase
    .schema("delivery")
    .from("cohort_teachers")
    .select("cohort_id")
    .eq("teacher_id", teacherId);

  if (mapError) throw mapError;
  const cohortIds = mappings?.map(m => m.cohort_id) || [];
  if (cohortIds.length === 0) return [];

  const { data: cohorts, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("*")
    .in("id", cohortIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!cohorts || cohorts.length === 0) return [];

  const programIds = [...new Set(cohorts.map(c => c.program_id).filter(Boolean))];
  let programs: Program[] = [];
  if (programIds.length > 0) {
    const { data: progData } = await supabase
      .schema("academic")
      .from("programs")
      .select("id, title")
      .in("id", programIds);
    programs = progData || [];
  }

  const instIds = [...new Set(cohorts.map(c => c.institution_id).filter(Boolean))];
  let institutions: Institution[] = [];
  if (instIds.length > 0) {
    const { data: instData } = await supabase
      .schema("institution")
      .from("institutions")
      .select("id, name")
      .in("id", instIds);
    institutions = instData || [];
  }

  return cohorts.map(cohort => ({
    ...cohort,
    program: programs.find(p => p.id === cohort.program_id) || null,
    institution: institutions.find(i => i.id === cohort.institution_id) || null
  }));
}

export async function assignTeacherToCohort(cohortId: string, teacherId: string) {
  validateAssignmentIds(cohortId, [teacherId]);
  await requireAcademicWrite("cohorts", cohortId, true);
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("cohort_teachers")
    .upsert({ cohort_id: cohortId, teacher_id: teacherId }, { onConflict: "cohort_id,teacher_id", ignoreDuplicates: true });
  if (error) throw error;
  return true;
}

export async function removeTeacherFromCohort(cohortId: string, teacherId: string) {
  validateAssignmentIds(cohortId, [teacherId]);
  await requireAcademicWrite("cohorts", cohortId, true);
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("cohort_teachers")
    .delete()
    .eq("cohort_id", cohortId)
    .eq("teacher_id", teacherId);
  if (error) throw error;
  return true;
}

export async function listCohortCourseAssignments(cohortId: string) {
  await requireCohortRead(cohortId);
  const supabase = await createClient();
  const { data: assignments, error } = await supabase
    .schema("delivery")
    .from("course_assignments")
    .select("*")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!assignments || assignments.length === 0) return [];

  const courseIds = assignments.map((a) => a.course_id);
  const { data: courses, error: courseError } = await supabase
    .schema("academic")
    .from("courses")
    .select("id, title, description")
    .in("id", courseIds);

  if (courseError) throw courseError;

  return assignments.map((a) => ({
    ...a,
    course: courses?.find(c => c.id === a.course_id) || null
  }));
}

export async function listCohortEnrollments(cohortId: string) {
  await requireCohortRead(cohortId);
  const supabase = await createClient();
  const { data: enrollments, error } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select(`
      *,
      cohort:cohort_id (
        id, 
        name, 
        code, 
        tenant_id
      )
    `)
    .eq("cohort_id", cohortId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = [...new Set(enrollments.map((e) => e.user_id).filter(Boolean))];
  const [userResult, assignmentResult] = await Promise.all([
    supabase.schema("core").from("users").select("id, full_name, email").in("id", studentIds),
    supabase.schema("delivery").from("course_assignments").select("*").eq("cohort_id", cohortId).is("deleted_at", null),
  ]);
  if (userResult.error) throw userResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  const students: CampusUser[] = userResult.data || [];
  const assignments = assignmentResult.data || [];

  const courseIds = assignments.map((a) => a.course_id);
  const progresses = await readProgressSnapshots(studentIds, courseIds, supabase);

  return enrollments.map((e) => {
    const student = students.find(s => s.id === e.user_id) || null;
    
    const userProgs = progresses.filter(p => p.user_id === e.user_id);
    const avgProgress = averageLearningProgress(userProgs.map(progress => progress.progress_percentage));

    return {
      ...e,
      student,
      progress_percentage: avgProgress
    };
  });
}

export async function listAllCohorts() {
  const caller = await getCurrentUser(true);
  if (!caller?.user) throw new Error("Access denied.");
  if (caller.primaryRole !== "super_admin") return caller.tenantId ? listCohorts(caller.tenantId) : [];
  const supabase = await createClient();
  const { data: cohorts, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw error;
  if (!cohorts || cohorts.length === 0) return [];

  const tenantIds = [...new Set(cohorts.map((c) => c.tenant_id).filter(Boolean))];
  let institutions: Institution[] = [];
  if (tenantIds.length > 0) {
    const { data: instData } = await supabase
      .schema("institution")
      .from("institutions")
      .select("id, name");
    institutions = instData || [];
  }

  return cohorts.map((c) => ({
    ...c,
    institution: institutions.find(i => i.id === c.tenant_id) || null
  }));
}

export async function syncCourseProgressByActivity(userId: string, activityId: string) {
  await requireStudentRead(userId);
  const supabase = await createClient();
  const { data: activity, error } = await supabase.schema("learning").from("activities").select("lesson_id").eq("id", activityId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!activity?.lesson_id) return;
  const scope = await academicScope("lessons", activity.lesson_id);
  if (scope.courseId) await syncCourseProgress(userId, scope.courseId);
}
