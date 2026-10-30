import { readAllPages, readByIds } from "./query-pages";
import { saveActivity, assignActivity } from "./learning-editor";
import { requireStudentRead, academicScope } from "./academic-access";
import { requireInstitutionAccess } from "./institution-access";
import { createClient } from "@/utils/supabase/server";
import { startQuiz, finishQuiz, approveRetake, quizContent, saveQuizQuestion } from "./quiz-engine";

function one<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

// ----------------------------------------------------
// Student Assigned Activities Fetching
// ----------------------------------------------------
export async function getStudentAssignedActivities(studentId: string) {
  await requireStudentRead(studentId);
  const supabase = await createClient();

  // 1. Get student's active cohorts
  const { data: enrollments, error: enrollError } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", studentId)
    .eq("status_code", "active")
    .is("deleted_at", null);

  if (enrollError) throw enrollError;
  if (!enrollments || enrollments.length === 0) return [];

  const cohortIds = enrollments.map(e => e.cohort_id);

  // 2. Fetch assignments for these cohorts
  const { data: assignments, error: assignError } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .select("*")
    .in("cohort_id", cohortIds)
    .is("deleted_at", null);

  if (assignError) throw assignError;
  if (!assignments || assignments.length === 0) return [];

  const activityIds = [...new Set(assignments.map(a => a.activity_id))];

  // 3. Fetch activities
  const { data: activities, error: actError } = await supabase
    .schema("learning")
    .from("activities")
    .select("*")
    .in("id", activityIds)
    .is("deleted_at", null);

  if (actError) throw actError;
  if (!activities || activities.length === 0) return [];

  // 4. Fetch progress records
  const { data: progressList, error: progError } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .select("*")
    .eq("student_id", studentId)
    .in("activity_id", activityIds)
    .is("deleted_at", null);

  if (progError) throw progError;

  // 4b. Fetch project submissions and reviews to check for revision requests
  const { data: projects } = await supabase
    .schema("learning")
    .from("projects")
    .select("id, activity_id")
    .in("activity_id", activityIds);

  const projectIds = projects?.map(p => p.id) || [];

  const { data: submissions } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("project_id, project_reviews(review_status)")
    .eq("student_id", studentId)
    .in("project_id", projectIds);

  // 5. Combine everything (map over assignments so each cohort-specific assignment gets its correct cohort_id)
  return assignments.map(assign => {
    const act = activities.find(a => a.id === assign.activity_id);
    if (!act) return null;

    let progress = progressList?.find(p => p.activity_assignment_id === assign.id);

    // If no progress record exists yet, return a mock/default start state
    if (!progress) {
      progress = {
        status_code: "assigned",
        score: null,
        attempt_number: 0,
        completed_at: null
      };
    }

    // Check if this is a project activity with a revision requested review status
    const relatedProj = projects?.find(p => p.activity_id === act.id);
    if (relatedProj) {
      const sub = submissions?.find(s => s.project_id === relatedProj.id);
      const reviews = one(sub?.project_reviews);
      const reviewStatus = Array.isArray(reviews) ? reviews[0]?.review_status : reviews?.review_status;
      if (reviewStatus === "revision_requested") {
        progress = {
          ...progress,
          status_code: "revision_requested"
        };
      }
    }

    return {
      ...act,
      assignment: {
        id: assign.id,
        cohort_id: assign.cohort_id,
        available_from: assign.available_from,
        available_until: assign.available_until,
        is_required: assign.is_required ?? true
      },
      progress
    };
  }).filter(Boolean);
}

// ----------------------------------------------------
// Quizzes Engine Operations
// ----------------------------------------------------
function seedRandom(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(array: T[], seedStr: string): T[] {
  const rand = seedRandom(seedStr);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function getActiveQuizAttempt(quizId: string, studentId: string) {
  const supabase = await createClient();
  const { data: attempt, error } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!attempt) return null;

  // Verify time limit on active attempt. If expired, auto-submit empty answers to close it.
  const { data: quiz } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("time_limit_minutes, strict_mode")
    .eq("id", quizId)
    .single();

  // Strict-mode attempts are never resumed: reaching this point with an
  // unfinished strict attempt means the student already left the quiz
  // environment (tab closed before the beacon fired, browser killed, etc.)
  // without going through the normal forfeit path. Close it out as
  // forfeited rather than letting them silently pick back up.
  if (quiz?.strict_mode) {
    await forfeitQuizAttempt(attempt.id, "left_quiz_environment");
    return null;
  }

  if (quiz && quiz.time_limit_minutes) {
    const elapsedSeconds = Math.floor((new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000);
    const limitSeconds = quiz.time_limit_minutes * 60;
    if (elapsedSeconds > limitSeconds + 60) {
      // Auto-submit to close the attempt as late
      await submitQuizAnswers(attempt.id, []);
      return null;
    }
  }

  return attempt;
}

export async function forfeitQuizAttempt(attemptId: string, reason: string) {
  return finishQuiz(attemptId, [], reason);
}

export async function approveQuizRetake(attemptId: string) {
  return approveRetake(attemptId);
}

export async function getQuizSessionDetails(attemptId: string) {
  const db = await createClient();
  const { data: attempt, error } = await db.schema("learning").from("quiz_attempts")
    .select("quiz_id").eq("id", attemptId).single();
  if (error) throw error;
  const { data: quiz, error: quizError } = await db.schema("learning").from("quizzes")
    .select("activity_id").eq("id", attempt.quiz_id).single();
  if (quizError) throw quizError;
  const result = await quizContent(quiz.activity_id, attemptId);
  if (!result.attempt) throw new Error("Quiz attempt no longer exists.");
  let questions = result.questions;
  if (result.quiz.shuffle_questions) questions = shuffleArray(questions, attemptId);
  if (result.quiz.shuffle_options) questions = questions.map(q => ({ ...q, options: shuffleArray(q.options, attemptId + q.id) }));
  return { ...result, attempt: result.attempt, questions: questions.map(q => ({ ...q,
    correctIndex: q.options.findIndex(o => o.is_correct === true),
    selectedIndex: q.options.findIndex(o => q.selected_option_ids?.includes(o.id)),
  })) };
}

export async function getQuizDetails(activityId: string) {
  return quizContent(activityId);
}

export async function startQuizAttempt(quizId: string, studentId: string, progressId: string) {
  return startQuiz(quizId, studentId, progressId);
}

export async function submitQuizAnswers(
  attemptId: string,
  answers: Array<{ questionId: string; selectedOptionId?: string; answerText?: string }>
) {
  return finishQuiz(attemptId, answers);
}

export async function getProjectDetails(activityId: string, studentId: string) {
  await requireStudentRead(studentId);
  const supabase = await createClient();

  const { data: project, error: projError } = await supabase
    .schema("learning")
    .from("projects")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();

  if (projError) throw projError;
  if (!project) throw new Error("Project details not found.");

  const { data: submission, error: submissionError } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("*")
    .eq("project_id", project.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (submissionError) throw submissionError;
  let review = null;
  if (submission) {
    const { data: revData, error: reviewError } = await supabase
      .schema("learning")
      .from("project_reviews")
      .select("*")
      .eq("submission_id", submission.id)
      .maybeSingle();
    if (reviewError) throw reviewError;
    review = revData;
  }

  return { project, submission, review };
}

export async function submitProject(
  projectId: string,
  studentId: string,
  progressId: string,
  githubUrl: string,
  notes?: string
) {
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("submit_project", {
    p_project: projectId, p_student: studentId, p_progress: progressId && progressId !== "new" ? progressId : null,
    p_url: githubUrl, p_notes: notes ?? null,
  });
  if (error) throw error;
  if (!data?.id) throw new Error("Project submission was not confirmed.");
  return data;
}

export async function getStudentAssignedChallenges(studentId: string) {
  await requireStudentRead(studentId);
  const supabase = await createClient();

  // 1. Get student's active cohorts
  const { data: enrollments, error: enrollError } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", studentId)
    .eq("status_code", "active")
    .is("deleted_at", null);

  if (enrollError) throw enrollError;
  if (!enrollments || enrollments.length === 0) return [];

  const cohortIds = enrollments.map(e => e.cohort_id);

  // 2. Fetch assignments for these cohorts
  const { data: assignments, error: assignError } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .select("*")
    .in("cohort_id", cohortIds)
    .is("deleted_at", null);

  if (assignError) throw assignError;
  if (!assignments || assignments.length === 0) return [];

  const activityIds = [...new Set(assignments.map(a => a.activity_id))];

  // 3. Fetch programming challenges joined with activities
  const { data: challenges, error: chalError } = await supabase
    .schema("learning")
    .from("programming_challenges")
    .select(`
      id,
      difficulty_level,
      activity_id,
      activities!inner (
        id,
        title,
        description,
        max_score
      )
    `)
    .in("activity_id", activityIds);

  if (chalError) throw chalError;
  if (!challenges || challenges.length === 0) return [];

  // 4. Fetch progress records
  const { data: progressList, error: progError } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .select("*")
    .eq("student_id", studentId)
    .in("activity_id", activityIds)
    .is("deleted_at", null);

  if (progError) throw progError;

  // 5. Fetch submission attempt counts
  const { data: submissions, error: subError } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("challenge_id, id")
    .eq("student_id", studentId);

  if (subError) throw subError;
  // Combine everything
  return challenges.map(chal => {
    const act = one(chal.activities);
    const assignment = assignments.find(a => a.activity_id === chal.activity_id);
    let progress = progressList?.find(p => p.activity_id === chal.activity_id);

    const attemptsCount = submissions?.filter(s => s.challenge_id === chal.id).length || 0;

    if (!progress) {
      progress = {
        status_code: "assigned",
        score: null,
        attempt_number: 0,
        completed_at: null
      };
    }

    return {
      challenge_id: chal.id,
      activity_id: chal.activity_id,
      title: act?.title,
      description: act?.description,
      difficulty: chal.difficulty_level,
      max_score: act?.max_score,
      assigned_date: assignment?.available_from || assignment?.created_at || null,
      due_date: assignment?.available_until || null,
      cohort_id: assignment?.cohort_id,
      status: progress.status_code,
      score: progress.score,
      attempts_count: attemptsCount
    };
  });
}

export async function getProgrammingChallengeDetails(activityId: string, studentId: string) {
  const supabase = await createClient();

  const { data: challenge, error: chalError } = await supabase
    .schema("learning")
    .from("programming_challenges")
    .select(`
      *,
      activities (
        title,
        description,
        instructions
      )
    `)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (chalError) throw chalError;
  if (!challenge) throw new Error("Programming challenge not found.");

  const act = one(challenge.activities);
  const content = { ...challenge, title: act?.title, description: act?.description, instructions: act?.instructions };

  const { data: staff, error: accessError } = await supabase.schema("learning").rpc("can_edit_activity", { p_activity_id: activityId });
  if (accessError) throw accessError;
  let progress = null;
  if (!staff) {
    const { data, error } = await supabase.schema("learning").rpc("start_coding_activity", { p_activity: activityId, p_student: studentId });
    if (error) throw error;
    progress = data;
  }

  const { data: examples } = await supabase
    .schema("learning")
    .from("challenge_examples")
    .select("*")
    .eq("challenge_id", challenge.id)
    .order("example_number");

  const { data: submissions } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("*")
    .eq("challenge_id", challenge.id)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });

  const { data: starterTemplates, error: starterError } = await supabase
    .schema("learning")
    .from("challenge_starter_templates")
    .select("language, starter_code")
    .eq("challenge_id", challenge.id);
  if (starterError) throw starterError;

  const starterCodeByLanguage: Record<string, string> = {};
  for (const tpl of starterTemplates || []) {
    starterCodeByLanguage[tpl.language] = tpl.starter_code;
  }

  return {
    challenge: content,
    progress,
    examples: examples || [],
    submissions: submissions || [],
    starterCodeByLanguage
  };
}

export async function upsertChallengeStarterTemplate(input: {
  challengeId: string;
  language: string;
  starterCode: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("challenge_starter_templates")
    .upsert(
      {
        challenge_id: input.challengeId,
        language: input.language,
        starter_code: input.starterCode,
        updated_at: new Date().toISOString()
      },
      { onConflict: "challenge_id,language" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateChallengeStrictMode(challengeId: string, strictMode: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("programming_challenges")
    .update({ strict_mode: strictMode, updated_at: new Date().toISOString() })
    .eq("id", challengeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getChallengeStarterTemplates(challengeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("challenge_starter_templates")
    .select("*")
    .eq("challenge_id", challengeId);
  if (error) throw error;
  return data || [];
}

// Forfeits an in-progress challenge attempt when the student leaves the
// locked-down IDE environment (tab switch, fullscreen exit, etc). Targets
// student_activity_progress rather than challenge_submissions, since a
// submission row doesn't exist until the student clicks Submit — mirrors
// forfeitQuizAttempt above, adapted for that difference.
export async function forfeitChallengeSubmission(progressId: string, studentId: string, reason: string) {
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("forfeit_coding_activity", {
    p_progress: progressId, p_student: studentId, p_reason: reason,
  });
  if (error) throw error;
  if (!data?.id) throw new Error("Coding session close was not confirmed.");
  return data;
}

export async function getVisibleTestCases(challengeId: string) {
  const supabase = await createClient();
  const { data: testCases, error: tcError } = await supabase
    .schema("learning")
    .from("challenge_test_cases")
    .select("id, input_data, expected_output, position")
    .eq("challenge_id", challengeId)
    .eq("is_hidden", false)
    .order("position");
  if (tcError) throw tcError;

  if (testCases && testCases.length > 0) {
    return testCases;
  }

  // Fallback to challenge examples
  const { data: examples, error: exError } = await supabase
    .schema("learning")
    .from("challenge_examples")
    .select("id, input_example, output_example, example_number")
    .eq("challenge_id", challengeId)
    .order("example_number");
  if (exError) throw exError;

  return (examples || []).map(ex => ({
    id: ex.id,
    input_data: ex.input_example,
    expected_output: ex.output_example,
    position: ex.example_number
  }));
}

export async function submitChallengeCode(
  challengeId: string,
  studentId: string,
  progressId: string,
  language: string,
  sourceCode: string
) {
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("submit_code", {
    p_challenge: challengeId, p_student: studentId, p_progress: progressId && progressId !== "new" ? progressId : null,
    p_language: language, p_source: sourceCode,
  });
  if (error) throw error;
  if (!data?.id) throw new Error("Code submission was not confirmed.");
  return data;
}

export async function getChallengeSubmissionResults(submissionId: string) {
  const supabase = await createClient();

  const { data: submission } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("submission_status_code, language, submitted_at")
    .eq("id", submissionId)
    .maybeSingle();

  const { data: result } = await supabase
    .schema("learning")
    .from("challenge_submission_results")
    .select("*")
    .eq("submission_id", submissionId)
    .maybeSingle();

  const { data: testCases } = await supabase
    .schema("learning")
    .from("challenge_test_case_results")
    .select("*")
    .eq("submission_id", submissionId);

  const { data: logs } = await supabase
    .schema("learning")
    .from("challenge_execution_logs")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at");

  return {
    submission: submission || null,
    result: result || null,
    testCases: testCases || [],
    logs: logs || []
  };
}

// ----------------------------------------------------
// Admin Creator & Manager Operations
// ----------------------------------------------------
export async function listAllActivities(tenantId: string) {
  await requireInstitutionAccess(tenantId, true);
  const supabase = await createClient();
  const data = await readAllPages((from, to) => supabase
    .schema("learning")
    .from("activities")
    .select("*, activity_assignments(cohort_id,deleted_at)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false }).order("id").range(from, to));


  return (data || []).map((act) => ({
    ...act,
    cohort_ids: (act.activity_assignments || []).filter((a: { deleted_at: string | null }) => !a.deleted_at).map((a: { cohort_id: string }) => a.cohort_id),
  }));
}

export async function createActivityAndSubclass(input: {
  tenant_id: string;
  institution_id: string;
  lesson_id: string;
  activity_type_code: string;
  status_code: string;
  title: string;
  description?: string;
  instructions?: string;
  max_score?: number;
  passing_score?: number;
  position?: number;
  is_mandatory?: boolean;
  
  quiz_time_limit?: number;
  quiz_max_attempts?: number;
  quiz_shuffle_questions?: boolean;
  quiz_shuffle_options?: boolean;
  quiz_show_results_immediately?: boolean;
  quiz_strict_mode?: boolean;

  project_overview?: string;
  project_requirements?: string;
  project_deliverables?: string;
  project_submission_instructions?: string;
  project_difficulty?: string;
  project_estimated_hours?: number;

  chal_difficulty?: string;
  chal_problem_statement?: string;
  chal_input_format?: string;
  chal_output_format?: string;
  chal_constraints?: string;
  chal_starter_code?: string;
  chal_time_limit?: number;
  chal_memory_limit?: number;
  chal_strict_mode?: boolean;
  questions?: Array<{ question_text: string; question_type: string; points: number; position: number;
    options: Array<{ optionText: string; isCorrect: boolean; position: number }> }>;
  assignments?: Array<{ cohort_id: string; is_required?: boolean; available_from?: string | null; available_until?: string | null }>;
}) {
  return saveActivity(null, input);
}

export async function createQuizQuestionAndOptions(
  quizId: string,
  questionText: string,
  questionType: string,
  points: number,
  position: number,
  options: Array<{ optionText: string; isCorrect: boolean; position: number }>
) {
  return saveQuizQuestion(quizId, null, questionText, questionType, points, position, options);
}


export async function createChallengeExample(input: {
  challenge_id: string;
  example_number: number;
  input_example: string;
  output_example: string;
  explanation?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("challenge_examples")
    .insert({
      challenge_id: input.challenge_id,
      example_number: input.example_number,
      input_example: input.input_example,
      output_example: input.output_example,
      explanation: input.explanation || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createChallengeTestCase(input: {
  challenge_id: string;
  input_data: string;
  expected_output: string;
  is_hidden?: boolean;
  position?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("challenge_test_cases")
    .insert({
      challenge_id: input.challenge_id,
      input_data: input.input_data,
      expected_output: input.expected_output,
      is_hidden: input.is_hidden ?? true,
      position: input.position ?? 1
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function assignActivityToCohort(input: {
  activity_id: string;
  cohort_id: string;
  is_required?: boolean;
  available_from?: string;
  available_until?: string;
  created_by?: string;
  publish?: boolean;
}) {
  return assignActivity(input);
}

export async function updateActivityAndSubclass(id: string, input: {
  activity_type_code: string;
  title: string;
  description?: string;
  instructions?: string;
  max_score?: number;
  passing_score?: number;
  is_mandatory?: boolean;
  
  quiz_time_limit?: number;
  quiz_max_attempts?: number;
  quiz_shuffle_questions?: boolean;
  quiz_shuffle_options?: boolean;
  quiz_show_results_immediately?: boolean;
  quiz_strict_mode?: boolean;

  project_overview?: string;
  project_requirements?: string;
  project_deliverables?: string;
  project_submission_instructions?: string;
  project_difficulty?: string;
  project_estimated_hours?: number;

  chal_difficulty?: string;
  chal_problem_statement?: string;
  chal_input_format?: string;
  chal_output_format?: string;
  chal_constraints?: string;
  chal_starter_code?: string;
  chal_time_limit?: number;
  chal_memory_limit?: number;
  chal_strict_mode?: boolean;

  assignments?: Array<{
    id: string;
    available_from?: string;
    available_until?: string;
    is_required?: boolean;
    cohort_id: string;
  }>;
}) {
  return saveActivity(id, input);
}

export async function listProjectSubmissions(tenantId: string) {
  await requireInstitutionAccess(tenantId, true);
  const supabase = await createClient();

  const projects = await readAllPages((from, to) => supabase
    .schema("learning")
    .from("projects")
    .select(`
      id,
      activity_id,
      max_score,
      activities!inner (
        id,
        title,
        passing_score,
        tenant_id
      )
    `)
    .eq("activities.tenant_id", tenantId).order("id").range(from, to));


  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);

  const submissions = await readByIds(projectIds, (group, from, to) => supabase
    .schema("learning")
    .from("project_submissions")
    .select("*, progress:student_activity_progress_id(assignment:activity_assignment_id(cohort_id))")
    .in("project_id", group)
    .order("submitted_at", { ascending: false }).order("id").range(from, to));


  if (!submissions || submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);
  const reviews = await readByIds(submissionIds, (group, from, to) => supabase
    .schema("learning")
    .from("project_reviews")
    .select("*")
    .in("submission_id", group).order("id").range(from, to));



  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const students = await readByIds(studentIds, (group, from, to) => supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", group).order("id").range(from, to));

  return submissions.sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at)).map(sub => {
    const project = projects.find(p => p.id === sub.project_id);
    const review = reviews?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      activity_id: project?.activity_id,
      cohort_id: one(one(sub.progress)?.assignment)?.cohort_id,
      project_title: one(project?.activities)?.title || "Unknown Project",
      max_score: Number(project?.max_score ?? 100),
      passing_score: Number(one(project?.activities)?.passing_score ?? 0),
      student,
      review
    };
  });
}

export async function reviewProjectSubmission(input: {
  submissionId: string;
  reviewerId: string;
  status: string;
  score: number;
  feedback: string;
}) {
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("review_project", {
    p_submission: input.submissionId, p_status: input.status, p_score: input.score, p_feedback: input.feedback,
  });
  if (error) throw error;
  if (!data?.id) throw new Error("Project review was not confirmed.");
  return data;
}

export async function listChallengeSubmissions(tenantId: string) {
  await requireInstitutionAccess(tenantId, true);
  const supabase = await createClient();

  const { data: challenges, error: chalError } = await supabase
    .schema("learning")
    .from("programming_challenges")
    .select(`
      id,
      activity_id,
      activities!inner (
        id,
        title,
        tenant_id,
        max_score
      )
    `)
    .eq("activities.tenant_id", tenantId);

  if (chalError) throw chalError;
  if (!challenges || challenges.length === 0) return [];

  const challengeIds = challenges.map(c => c.id);

  const { data: submissions, error: subError } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("*")
    .in("challenge_id", challengeIds)
    .order("submitted_at", { ascending: false });

  if (subError) throw subError;
  if (!submissions || submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);
  const { data: results } = await supabase
    .schema("learning")
    .from("challenge_submission_results")
    .select("*")
    .in("submission_id", submissionIds);

  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: students } = await supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", studentIds);

  return submissions.map(sub => {
    const challenge = challenges.find(c => c.id === sub.challenge_id);
    const result = results?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      challenge_title: one(challenge?.activities)?.title || "Unknown Challenge",
      max_score: Number(one(challenge?.activities)?.max_score || 100),
      student,
      result
    };
  });
}

export async function ensureLessonProjectActivity(lessonId: string, studentId: string, courseId: string) {
  await requireStudentRead(studentId);
  const scope = await academicScope("lessons", lessonId);
  if (scope.courseId !== courseId) throw new Error("Invalid course lesson.");
  const db = await createClient();
  const { data, error } = await db.schema("learning").from("activities").select("id")
    .eq("lesson_id", lessonId).eq("activity_type_code", "project").eq("status_code", "published")
    .is("deleted_at", null).order("position").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your instructor has not assigned a project to this lesson yet.");
  return { success: true, activityId: data.id };
}

export async function listCohortProjectSubmissions(cohortId: string) {
  const supabase = await createClient();

  const assignments = await readAllPages((from, to) => supabase
    .schema("learning")
    .from("activity_assignments")
    .select("activity_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null).order("id").range(from, to));


  if (!assignments || assignments.length === 0) return [];

  const activityIds = assignments.map(a => a.activity_id);

  const projects = await readByIds(activityIds, (group, from, to) => supabase
    .schema("learning")
    .from("projects")
    .select(`
      id,
      activity_id,
      max_score,
      activities!inner (
        id,
        title,
        passing_score
      )
    `)
    .in("activity_id", group).order("id").range(from, to));


  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);

  const submissions = await readByIds(projectIds, (group, from, to) => supabase
    .schema("learning")
    .from("project_submissions")
    .select("*, progress:student_activity_progress_id(assignment:activity_assignment_id(cohort_id))")
    .in("project_id", group)
    .order("submitted_at", { ascending: false }).order("id").range(from, to));


  if (!submissions || submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);
  const reviews = await readByIds(submissionIds, (group, from, to) => supabase
    .schema("learning")
    .from("project_reviews")
    .select("*")
    .in("submission_id", group).order("id").range(from, to));



  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const students = await readByIds(studentIds, (group, from, to) => supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", group).order("id").range(from, to));

  return submissions.sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at)).map(sub => {
    const project = projects.find(p => p.id === sub.project_id);
    const review = reviews?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      activity_id: project?.activity_id,
      cohort_id: one(one(sub.progress)?.assignment)?.cohort_id,
      project_title: one(project?.activities)?.title || "Unknown Project",
      max_score: Number(project?.max_score ?? 100),
      passing_score: Number(one(project?.activities)?.passing_score ?? 0),
      student,
      review
    };
  });
}

export async function listCohortChallengeSubmissions(cohortId: string) {
  const supabase = await createClient();

  const { data: assignments, error: assignError } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .select("activity_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null);

  if (assignError) throw assignError;
  if (!assignments || assignments.length === 0) return [];

  const activityIds = assignments.map(a => a.activity_id);

  const { data: challenges, error: chalError } = await supabase
    .schema("learning")
    .from("programming_challenges")
    .select(`
      id,
      activity_id,
      activities!inner (
        id,
        title,
        max_score
      )
    `)
    .in("activity_id", activityIds);

  if (chalError) throw chalError;
  if (!challenges || challenges.length === 0) return [];

  const challengeIds = challenges.map(c => c.id);

  const { data: submissions, error: subError } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("*")
    .in("challenge_id", challengeIds)
    .order("submitted_at", { ascending: false });

  if (subError) throw subError;
  if (!submissions || submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);
  const { data: results } = await supabase
    .schema("learning")
    .from("challenge_submission_results")
    .select("*")
    .in("submission_id", submissionIds);

  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: students } = await supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", studentIds);

  return submissions.map(sub => {
    const challenge = challenges.find(c => c.id === sub.challenge_id);
    const result = results?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      challenge_title: one(challenge?.activities)?.title || "Unknown Challenge",
      max_score: Number(one(challenge?.activities)?.max_score || 100),
      student,
      result
    };
  });
}

export async function listCohortActivities(cohortId: string) {
  const supabase = await createClient();

  const { data: assignments, error: assignError } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .select("activity_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null);

  if (assignError) throw assignError;
  if (!assignments || assignments.length === 0) return [];

  const activityIds = assignments.map(a => a.activity_id);

  const { data: activities, error } = await supabase
    .schema("learning")
    .from("activities")
    .select("*")
    .in("id", activityIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return activities || [];
}

export async function listCohortQuizAttempts(cohortId: string) {
  const supabase = await createClient();

  const { data: assignments, error: assignError } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .select("activity_id")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null);

  if (assignError) throw assignError;
  if (!assignments || assignments.length === 0) return [];

  const activityIds = assignments.map(a => a.activity_id);

  const { data: quizzes, error: qError } = await supabase
    .schema("learning")
    .from("quizzes")
    .select(`
      id,
      activity_id,
      activities!inner (
        id,
        title,
        max_score
      )
    `)
    .in("activity_id", activityIds);

  if (qError) throw qError;
  if (!quizzes || quizzes.length === 0) return [];

  const quizIds = quizzes.map(q => q.id);

  const { data: attempts, error: attError } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*")
    .in("quiz_id", quizIds)
    .order("submitted_at", { ascending: false });

  if (attError) throw attError;
  if (!attempts || attempts.length === 0) return [];

  const studentIds = [...new Set(attempts.map(a => a.student_id))];
  const { data: students } = await supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", studentIds);

  return attempts.map(att => {
    const quiz = quizzes.find(q => q.id === att.quiz_id);
    const student = students?.find(s => s.id === att.student_id) || null;

    return {
      ...att,
      quiz_title: one(quiz?.activities)?.title || "Unknown Quiz",
      activity_max_score: Number(one(quiz?.activities)?.max_score || 100),
      student,
      activity_id: quiz?.activity_id
    };
  });
}

export async function deleteActivity(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("activities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteQuizQuestion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

export async function updateQuizQuestionAndOptions(
  questionId: string,
  questionText: string,
  questionType: string,
  points: number,
  options: Array<{ optionText: string; isCorrect: boolean; position: number }>
) {
  const db = await createClient();
  const { data: question, error } = await db.schema("learning").from("quiz_questions")
    .select("quiz_id,position").eq("id", questionId).single();
  if (error) throw error;
  return saveQuizQuestion(question.quiz_id, questionId, questionText, questionType, points, question.position ?? 1, options);
}
