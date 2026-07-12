import { createClient } from "@/utils/supabase/server";
import { getSessionTenant } from "./academic";

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
  const supabase = await createClient();
  const { data: cohorts, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!cohorts || cohorts.length === 0) return [];

  // Fetch programs manually (cross-schema)
  const programIds = [...new Set(cohorts.map(c => c.program_id).filter(Boolean))];
  let programs: any[] = [];
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
  let institutions: any[] = [];
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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const tenantId = input.tenant_id || session.tenantId;
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
  const supabase = await createClient();
  const session = await getSessionTenant();
  if (!session) throw new Error("No active session found.");

  const { data, error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .update({
      name: input.name,
      code: input.code,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status_code: input.status_code,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCohort(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("cohorts")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id);

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
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!enrollments) return [];
  
  // Filter enrollments belonging to the user's institution
  const filtered = enrollments.filter((e: any) => e.cohort?.tenant_id === tenantId);
  if (filtered.length === 0) return [];

  // Fetch student details from core.users (cross-schema)
  const studentIds = [...new Set(filtered.map((e: any) => e.user_id).filter(Boolean))];
  let students: any[] = [];
  if (studentIds.length > 0) {
    const { data: userData } = await supabase
      .schema("core")
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);
    students = userData || [];
  }

  // Fetch course progress & course assignments to calculate actual progress percentage
  let assignments: any[] = [];
  try {
    const { data: assignData } = await supabase
      .schema("delivery")
      .from("course_assignments")
      .select("*")
      .is("deleted_at", null);
    assignments = assignData || [];
  } catch (err) {
    console.error("Failed to fetch assignments in listEnrollments:", err);
  }

  let progressRecords: any[] = [];
  try {
    const { data: progData } = await supabase
      .schema("delivery")
      .from("course_progress")
      .select("*")
      .in("user_id", studentIds);
    progressRecords = progData || [];
  } catch (err) {
    console.error("Failed to fetch course progress in listEnrollments:", err);
  }

  return filtered.map((e: any) => {
    const student = students.find(s => s.id === e.user_id) || null;
    
    // Find course assignments for this cohort
    const cohortAssignments = assignments.filter(a => a.cohort_id === e.cohort_id);
    const assignedCourseIds = cohortAssignments.map(a => a.course_id);
    
    // Find student course progress for these courses
    const studentProgress = progressRecords.filter(p => p.user_id === e.user_id && assignedCourseIds.includes(p.course_id));
    
    // Calculate average progress percentage
    let totalProgress = 0;
    const count = assignedCourseIds.length;
    if (count > 0) {
      for (const courseId of assignedCourseIds) {
        const prog = studentProgress.find(p => p.course_id === courseId);
        totalProgress += prog ? (prog.progress_percentage || 0) : 0;
      }
    }
    const avgProgress = count > 0 ? parseFloat((totalProgress / count).toFixed(2)) : 0;

    return {
      ...e,
      student,
      progress_percentage: avgProgress
    };
  });
}

export async function enrollStudent(input: EnrollmentInput) {
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

  const isCohortActive = (cohort: any) => {
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
      const cohort = enroll.cohort as any;
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
  const supabase = await createClient();

  const isCohortActive = (cohort: any) => {
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
      .eq("id", id)
      .single();

    if (ceError || !currentEnroll) throw new Error("Enrollment not found.");

    const currentCohort = currentEnroll.cohort as any;
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
        const cohort = enroll.cohort as any;
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
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeEnrollment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("enrollments")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id);

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
  const supabase = await createClient();
  const { data: assignments, error } = await supabase
    .schema("delivery")
    .from("course_assignments")
    .select(`
      *,
      cohort:cohort_id (
        id, 
        name, 
        code,
        tenant_id
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!assignments) return [];

  // Filter assignments belonging to the user's institution
  const filtered = assignments.filter((a: any) => a.cohort?.tenant_id === tenantId);
  if (filtered.length === 0) return [];

  // Fetch courses from academic.courses (cross-schema)
  const courseIds = [...new Set(filtered.map((a: any) => a.course_id).filter(Boolean))];
  let courses: any[] = [];
  if (courseIds.length > 0) {
    const { data: courseData } = await supabase
      .schema("academic")
      .from("courses")
      .select("id, title, description")
      .in("id", courseIds);
    courses = courseData || [];
  }

  return filtered.map((a: any) => ({
    ...a,
    course: courses.find(c => c.id === a.course_id) || null
  }));
}

export async function assignCourse(input: CourseAssignmentInput) {
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
  const supabase = await createClient();
  const { error } = await supabase
    .schema("delivery")
    .from("course_assignments")
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// Student Dashboard / Learning Progress Operations
// ----------------------------------------------------
export async function getStudentDeliveryData(userId: string) {
  const supabase = await createClient();
  
  // 1. Fetch active enrollments (same schema relations are fine)
  const { data: enrollments, error: enrollError } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select(`
      *,
      cohort:cohort_id (
        id,
        name,
        code,
        program_id
      )
    `)
    .eq("user_id", userId)
    .eq("status_code", "active")
    .is("deleted_at", null);

  if (enrollError) throw enrollError;
  if (!enrollments || enrollments.length === 0) return [];

  // Fetch programs manually (cross-schema)
  const programIds = [...new Set(enrollments.map(e => e.cohort?.program_id).filter(Boolean))];
  let programs: any[] = [];
  if (programIds.length > 0) {
    const { data: progData } = await supabase
      .schema("academic")
      .from("programs")
      .select(`
        id, 
        title, 
        description,
        status:status_id (
          code
        )
      `)
      .in("id", programIds);
    programs = (progData || []).filter((p: any) => p.status?.code === "active");
  }

  // Group cohorts and programs
  const resultProgramsMap: Record<string, any> = {};

  for (const enrollment of enrollments) {
    const cohort = enrollment.cohort;
    if (!cohort) continue;

    const program = programs.find(p => p.id === cohort.program_id);
    if (!program) continue;

    if (!resultProgramsMap[program.id]) {
      resultProgramsMap[program.id] = {
        id: program.id,
        title: program.title,
        description: program.description,
        status_code: program.status?.code || "active",
        cohorts: [],
        courses: []
      };
    }

    resultProgramsMap[program.id].cohorts.push({
      id: cohort.id,
      name: cohort.name,
      code: cohort.code
    });

    // 2. Fetch assigned courses for this cohort
    const { data: assignments, error: assignError } = await supabase
      .schema("delivery")
      .from("course_assignments")
      .select("*")
      .eq("cohort_id", cohort.id)
      .is("deleted_at", null);

    if (assignError) throw assignError;

    if (assignments && assignments.length > 0) {
      // Fetch courses manually (cross-schema)
      const courseIds = [...new Set(assignments.map(a => a.course_id).filter(Boolean))];
      let courses: any[] = [];
      if (courseIds.length > 0) {
        const { data: courseData } = await supabase
          .schema("academic")
          .from("courses")
          .select(`
            id,
            title,
            description,
            duration_minutes,
            course_type:course_type_id (code, description)
          `)
          .in("id", courseIds);
        courses = courseData || [];
      }

      for (const assignment of assignments) {
        const course = courses.find(c => c.id === assignment.course_id);
        if (!course) continue;

        // Recalculate/Sync course progress to account for dynamic teacher modifications
        const progressRecord = await syncCourseProgress(userId, course.id);

        // Check if course is already added from another cohort to avoid duplicates
        const existingCourse = resultProgramsMap[program.id].courses.find((c: any) => c.id === course.id);
        if (!existingCourse) {
          resultProgramsMap[program.id].courses.push({
            id: course.id,
            title: course.title,
            description: course.description,
            duration_minutes: course.duration_minutes,
            course_type: course.course_type?.code || "Theory",
            isRequired: assignment.is_required,
            startDate: assignment.start_date,
            dueDate: assignment.due_date,
            progress: progressRecord || {
              completed_lessons: 0,
              total_lessons: 0,
              progress_percentage: 0,
              status_code: "not_started"
            }
          });
        }
      }
    }
  }

  return Object.values(resultProgramsMap);
}

export async function getLessonProgress(userId: string, lessonId: string) {
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
  const supabase = await createClient();
  
  // 1. Get or create lesson progress
  let { data: progress, error } = await supabase
    .schema("delivery")
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (!progress) {
    // Create new
    const { data: newProg, error: insertError } = await supabase
      .schema("delivery")
      .from("lesson_progress")
      .insert({
        user_id: userId,
        lesson_id: lessonId,
        status_code: "in_progress",
        progress_percentage: 10, // Start with 10%
        started_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;
    progress = newProg;
  } else if (progress.status_code === "not_started") {
    // Update to in_progress
    const { data: updatedProg, error: updateError } = await supabase
      .schema("delivery")
      .from("lesson_progress")
      .update({
        status_code: "in_progress",
        progress_percentage: 10,
        started_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", progress.id)
      .select()
      .single();

    if (updateError) throw updateError;
    progress = updatedProg;
  } else {
    // Just update last accessed
    const { data: updatedProg, error: updateError } = await supabase
      .schema("delivery")
      .from("lesson_progress")
      .update({
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", progress.id)
      .select()
      .single();

    if (updateError) throw updateError;
    progress = updatedProg;
  }

  // Recalculate/Sync course progress (will do dynamically on completion or progress change)
  await syncCourseProgress(userId, courseId);

  return progress;
}

export async function completeLessonProgress(userId: string, lessonId: string, courseId: string) {
  const supabase = await createClient();

  // Upsert or update progress to completed (100%)
  const { data: progress, error } = await supabase
    .schema("delivery")
    .from("lesson_progress")
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      status_code: "completed",
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: "user_id,lesson_id"
    })
    .select()
    .single();

  if (error) throw error;

  // Sync the overall course progress
  await syncCourseProgress(userId, courseId);

  return progress;
}

export async function syncCourseProgress(userId: string, courseId: string) {
  const supabase = await createClient();

  // 1. Get all lesson IDs for this course
  // course -> modules -> lessons
  const { data: modules, error: modError } = await supabase
    .schema("academic")
    .from("modules")
    .select("id")
    .eq("course_id", courseId)
    .is("deleted_at", null);

  if (modError) throw modError;
  const moduleIds = (modules || []).map(m => m.id);

  let totalLessons = 0;
  let completedLessons = 0;
  let startedLessons = 0;

  if (moduleIds.length > 0) {
    const { data: lessons, error: lesError } = await supabase
      .schema("academic")
      .from("lessons")
      .select("id")
      .in("module_id", moduleIds)
      .is("deleted_at", null);

    if (lesError) throw lesError;
    totalLessons = lessons ? lessons.length : 0;

    const lessonIds = (lessons || []).map(l => l.id);

    if (lessonIds.length > 0) {
      // Get count of completed lessons
      const { data: completedProgress } = await supabase
        .schema("delivery")
        .from("lesson_progress")
        .select("id, status_code")
        .eq("user_id", userId)
        .in("lesson_id", lessonIds);

      completedLessons = (completedProgress || []).filter(p => p.status_code === "completed").length;
      startedLessons = (completedProgress || []).filter(p => p.status_code === "in_progress" || p.status_code === "completed").length;
    }
  }

  // 2. Calculate percentage
  const progressPercentage = totalLessons > 0 ? parseFloat(((completedLessons / totalLessons) * 100).toFixed(2)) : 0;
  
  // Resolve status
  let statusCode = "not_started";
  if (progressPercentage === 100) {
    statusCode = "completed";
  } else if (startedLessons > 0 || progressPercentage > 0) {
    statusCode = "in_progress";
  }

  // 3. Upsert course progress record
  const progressData: any = {
    user_id: userId,
    course_id: courseId,
    status_code: statusCode,
    completed_lessons: completedLessons,
    total_lessons: totalLessons,
    progress_percentage: progressPercentage,
    last_accessed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (statusCode === "in_progress" && progressPercentage > 0) {
    // If not set yet, started_at could be set, but let's just make it simple
    progressData.started_at = new Date().toISOString();
  } else if (statusCode === "completed") {
    progressData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .schema("delivery")
    .from("course_progress")
    .upsert(progressData, {
      onConflict: "user_id,course_id"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listStudentLessonProgress(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("delivery")
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId);
    
  if (error) throw error;
  return data || [];
}
