import { createClient } from "@/utils/supabase/server";
import { syncCourseProgressByActivity } from "./delivery";

// ----------------------------------------------------
// Student Assigned Activities Fetching
// ----------------------------------------------------
export async function getStudentAssignedActivities(studentId: string) {
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

    let progress = progressList?.find(p => p.activity_id === act.id);

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
      const reviews = sub?.project_reviews as any;
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
  const supabase = await createClient();

  const { data: attempt, error: attError } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attError) throw attError;

  // Idempotent: a second forfeit/submit call for an already-closed attempt
  // just returns what's already there instead of erroring or double-zeroing.
  if (attempt.submitted_at) {
    return attempt;
  }

  const { data: quiz } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("activity_id")
    .eq("id", attempt.quiz_id)
    .single();

  const { data: questions } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .select("id, points")
    .eq("quiz_id", attempt.quiz_id);

  const totalMaxScore = (questions || []).reduce((sum, q) => sum + Number(q.points ?? 1), 0);

  const answersToInsert = (questions || []).map(q => ({
    attempt_id: attemptId,
    question_id: q.id,
    selected_option_id: null,
    answer_text: null,
    is_correct: false,
    points_awarded: 0
  }));

  if (answersToInsert.length > 0) {
    const { error: insError } = await supabase
      .schema("learning")
      .from("quiz_answers")
      .insert(answersToInsert);
    if (insError) throw insError;
  }

  const { data: updatedAttempt } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .update({
      submitted_at: new Date().toISOString(),
      score: 0,
      max_score: totalMaxScore,
      passed: false,
      forfeited: true,
      forfeit_reason: reason,
      time_spent_seconds: Math.floor((new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000)
    })
    .eq("id", attemptId)
    .select()
    .single();

  await supabase
    .schema("learning")
    .from("student_activity_progress")
    .update({
      status_code: "failed",
      score: 0,
      max_score: totalMaxScore,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", attempt.student_activity_progress_id);

  if (quiz?.activity_id) {
    await syncCourseProgressByActivity(attempt.student_id, quiz.activity_id);
  }

  return updatedAttempt;
}

export async function approveQuizRetake(attemptId: string) {
  const supabase = await createClient();

  const { data: attempt, error: attError } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attError || !attempt) throw new Error("Quiz attempt not found.");

  const { data: quiz } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("activity_id")
    .eq("id", attempt.quiz_id)
    .single();

  const { data: progress } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .select("attempt_number")
    .eq("id", attempt.student_activity_progress_id)
    .single();

  const currentAttempts = progress?.attempt_number || 0;
  const newAttempts = Math.max(0, currentAttempts - 1);

  const { error: progError } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .update({
      status_code: "started",
      score: null,
      completed_at: null,
      attempt_number: newAttempts,
      updated_at: new Date().toISOString()
    })
    .eq("id", attempt.student_activity_progress_id);

  if (progError) throw progError;

  if (quiz?.activity_id) {
    await syncCourseProgressByActivity(attempt.student_id, quiz.activity_id);
  }

  return { success: true };
}

export async function getQuizSessionDetails(attemptId: string) {
  const supabase = await createClient();

  // 1. Fetch Attempt
  const { data: attempt, error: attError } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attError) throw attError;

  // 2. Fetch Quiz
  const { data: quiz, error: quizError } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("*")
    .eq("id", attempt.quiz_id)
    .single();

  if (quizError) throw quizError;

  // 3. Fetch Questions
  const { data: questions, error: qError } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  if (qError) throw qError;

  const questionIds = (questions || []).map(q => q.id);
  let options: any[] = [];

  if (questionIds.length > 0) {
    const { data: optData, error: optError } = await supabase
      .schema("learning")
      .from("quiz_options")
      .select("id, question_id, option_text, position, is_correct")
      .in("question_id", questionIds)
      .order("position", { ascending: true });

    if (optError) throw optError;
    options = optData || [];
  }

  // Fetch student answers
  const { data: answersData } = await supabase
    .schema("learning")
    .from("quiz_answers")
    .select("*")
    .eq("attempt_id", attemptId);

  // Map options to questions
  let quizQuestionsList = (questions || []).map(q => {
    const qOpts = options.filter(o => o.question_id === q.id);
    const ans = answersData?.find(a => a.question_id === q.id);
    return {
      ...q,
      options: qOpts,
      correctIndex: qOpts.findIndex((o: any) => o.is_correct === true),
      selectedIndex: qOpts.findIndex((o: any) => o.id === ans?.selected_option_id)
    };
  });

  // Apply shuffling if configuration permits (seeded by attemptId)
  if (quiz.shuffle_questions) {
    quizQuestionsList = shuffleArray(quizQuestionsList, attemptId);
  }
  if (quiz.shuffle_options) {
    quizQuestionsList = quizQuestionsList.map(q => {
      // Find correct option and selected option before shuffling to preserve correctIndex & selectedIndex mapping
      const correctOpt = q.options[q.correctIndex] as any;
      const selectedOpt = q.options[q.selectedIndex] as any;
      const shuffledOpts = shuffleArray(q.options, attemptId + q.id);
      return {
        ...q,
        options: shuffledOpts,
        correctIndex: shuffledOpts.findIndex((o: any) => o.id === correctOpt?.id),
        selectedIndex: shuffledOpts.findIndex((o: any) => o.id === selectedOpt?.id)
      };
    });
  }

  return {
    quiz,
    attempt,
    questions: quizQuestionsList
  };
}

export async function getQuizDetails(activityId: string) {
  const supabase = await createClient();

  const { data: quiz, error: quizError } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();

  if (quizError) throw quizError;
  if (!quiz) throw new Error("Quiz definition not found for this activity.");

  const { data: questions, error: qError } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  if (qError) throw qError;

  const questionIds = (questions || []).map(q => q.id);
  let options: any[] = [];

  if (questionIds.length > 0) {
    const { data: optData, error: optError } = await supabase
      .schema("learning")
      .from("quiz_options")
      .select("id, question_id, option_text, position")
      .in("question_id", questionIds)
      .order("position", { ascending: true });

    if (optError) throw optError;
    options = optData || [];
  }

  return {
    quiz,
    questions: (questions || []).map(q => ({
      ...q,
      options: options.filter(o => o.question_id === q.id)
    }))
  };
}

export async function startQuizAttempt(quizId: string, studentId: string, progressId: string, attemptNumber: number = 1) {
  const supabase = await createClient();

  // Enforce Max Attempts limit
  const { data: quizObj, error: quizFetchError } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("activity_id, max_attempts")
    .eq("id", quizId)
    .single();

  if (quizFetchError) throw quizFetchError;

  // Enforce Availability Dates
  const { data: enrollments } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", studentId)
    .eq("status_code", "active")
    .is("deleted_at", null);

  if (enrollments && enrollments.length > 0) {
    const cohortIds = enrollments.map(e => e.cohort_id);
    const { data: assign } = await supabase
      .schema("learning")
      .from("activity_assignments")
      .select("available_from, available_until")
      .eq("activity_id", quizObj.activity_id)
      .in("cohort_id", cohortIds)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (assign) {
      const now = new Date();
      if (assign.available_from && new Date(assign.available_from) > now) {
        throw new Error("This quiz is not available yet.");
      }
      if (assign.available_until && new Date(assign.available_until) < now) {
        throw new Error("This quiz's due date has passed. You cannot start a new attempt.");
      }
    }
  }

  const { count, error: countError } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*", { count: "exact", head: true })
    .eq("quiz_id", quizId)
    .eq("student_id", studentId);

  if (countError) throw countError;
  if (count !== null && count >= (quizObj.max_attempts ?? 1)) {
    throw new Error("Maximum attempts limit reached for this quiz.");
  }

  // A student who has already passed doesn't need (or get) another attempt,
  // even if attempts remain under max_attempts.
  const { data: passedAttempt } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("id")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .eq("passed", true)
    .limit(1)
    .maybeSingle();

  if (passedAttempt) {
    throw new Error("You have already passed this quiz. No further attempts are needed.");
  }

  const nextAttemptNumber = (count || 0) + 1;

  // Create progress record if it doesn't exist
  let actualProgressId = progressId;
  if (!progressId || progressId === "new") {
    if (quizObj) {
      // Find assignment
      const { data: assign } = await supabase
        .schema("learning")
        .from("activity_assignments")
        .select("id")
        .eq("activity_id", quizObj.activity_id)
        .limit(1)
        .maybeSingle();

      if (assign) {
        const { data: prog } = await supabase
          .schema("learning")
          .from("student_activity_progress")
          .upsert({
            student_id: studentId,
            activity_id: quizObj.activity_id,
            activity_assignment_id: assign.id,
            status_code: "started",
            attempt_number: nextAttemptNumber,
            started_at: new Date().toISOString()
          }, { onConflict: "student_id,activity_assignment_id" })
          .select("id")
          .single();
        if (prog) actualProgressId = prog.id;
      }
    }
  } else {
    // Update progress status to started
    await supabase
      .schema("learning")
      .from("student_activity_progress")
      .update({
        status_code: "started",
        attempt_number: nextAttemptNumber,
        started_at: new Date().toISOString()
      })
      .eq("id", progressId);
  }

  const { data, error } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: studentId,
      student_activity_progress_id: actualProgressId,
      attempt_number: nextAttemptNumber,
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitQuizAnswers(
  attemptId: string,
  answers: Array<{ questionId: string; selectedOptionId?: string; answerText?: string }>
) {
  const supabase = await createClient();

  // 1. Fetch Attempt
  const { data: attempt, error: attError } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attError) throw attError;

  // 2. Fetch Quiz and Questions for grading
  const { data: quiz } = await supabase
    .schema("learning")
    .from("quizzes")
    .select("activity_id, time_limit_minutes")
    .eq("id", attempt.quiz_id)
    .single();

  if (attempt.submitted_at) {
    throw new Error("This quiz attempt has already been submitted.");
  }

  const elapsedSeconds = Math.floor((new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000);
  if (quiz?.time_limit_minutes) {
    const limitSeconds = quiz.time_limit_minutes * 60;
    // Enforce time limit with a 60-second latency buffer. If it's a late submission with answers, reject it.
    if (elapsedSeconds > limitSeconds + 60 && answers && answers.length > 0) {
      throw new Error("Quiz time limit exceeded. Answers cannot be submitted.");
    }
  }

  const { data: questions } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", attempt.quiz_id);

  // Fetch correct options
  const questionIds = (questions || []).map(q => q.id);
  const { data: correctOptions } = await supabase
    .schema("learning")
    .from("quiz_options")
    .select("id, question_id")
    .in("question_id", questionIds)
    .eq("is_correct", true);

  let totalScore = 0;
  let totalMaxScore = 0;
  const answersToInsert: any[] = [];

  for (const question of questions || []) {
    const maxPoints = Number(question.points ?? 1);
    totalMaxScore += maxPoints;

    const selections = answers.filter(ans => ans.questionId === question.id);
    const correctOpts = correctOptions?.filter(o => o.question_id === question.id) || [];

    let isCorrect = false;
    if (question.question_type === "single_choice" || question.question_type === "true_false") {
      const selectedOptId = selections[0]?.selectedOptionId;
      isCorrect = selectedOptId ? correctOpts.some(o => o.id === selectedOptId) : false;
    } else if (question.question_type === "multiple_choice") {
      const selectedIds = selections.map(s => s.selectedOptionId).filter(Boolean) as string[];
      const correctIds = correctOpts.map(c => c.id);
      isCorrect = selectedIds.length === correctIds.length &&
                  selectedIds.every(id => correctIds.includes(id));
    }

    const pointsAwarded = isCorrect ? maxPoints : 0;
    totalScore += pointsAwarded;

    if (selections.length === 0) {
      answersToInsert.push({
        attempt_id: attemptId,
        question_id: question.id,
        selected_option_id: null,
        answer_text: null,
        is_correct: false,
        points_awarded: 0
      });
    } else {
      selections.forEach((sel, index) => {
        answersToInsert.push({
          attempt_id: attemptId,
          question_id: question.id,
          selected_option_id: sel.selectedOptionId || null,
          answer_text: sel.answerText || null,
          is_correct: isCorrect,
          points_awarded: index === 0 ? pointsAwarded : 0
        });
      });
    }
  }

  // 3. Insert Answers
  if (answersToInsert.length > 0) {
    const { error: insError } = await supabase
      .schema("learning")
      .from("quiz_answers")
      .insert(answersToInsert);
    if (insError) throw insError;
  }

  // Determine passing state
  let passed = true;
  if (quiz?.activity_id) {
    const { data: activity } = await supabase
      .schema("learning")
      .from("activities")
      .select("passing_score")
      .eq("id", quiz.activity_id)
      .single();

    if (activity && activity.passing_score) {
      passed = totalScore >= activity.passing_score;
    }
  }

  // 4. Update Attempt
  const { data: updatedAttempt } = await supabase
    .schema("learning")
    .from("quiz_attempts")
    .update({
      submitted_at: new Date().toISOString(),
      score: totalScore,
      max_score: totalMaxScore,
      passed,
      time_spent_seconds: Math.floor((new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000)
    })
    .eq("id", attemptId)
    .select()
    .single();

  // 5. Update Student Activity Progress
  await supabase
    .schema("learning")
    .from("student_activity_progress")
    .update({
      status_code: passed ? "completed" : "failed",
      score: totalScore,
      max_score: totalMaxScore,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", attempt.student_activity_progress_id);

  if (quiz?.activity_id) {
    await syncCourseProgressByActivity(attempt.student_id, quiz.activity_id);
  }
 
  return updatedAttempt;
}

// ----------------------------------------------------
// Projects Operations
// ----------------------------------------------------
export async function getProjectDetails(activityId: string, studentId: string) {
  const supabase = await createClient();

  const { data: project, error: projError } = await supabase
    .schema("learning")
    .from("projects")
    .select("*")
    .eq("activity_id", activityId)
    .maybeSingle();

  if (projError) throw projError;
  if (!project) throw new Error("Project details not found.");

  const { data: submission } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("*")
    .eq("project_id", project.id)
    .eq("student_id", studentId)
    .maybeSingle();

  let review = null;
  if (submission) {
    const { data: revData } = await supabase
      .schema("learning")
      .from("project_reviews")
      .select("*")
      .eq("submission_id", submission.id)
      .maybeSingle();
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
  const supabase = await createClient();

  // A submission is locked from resubmission the moment it exists, until a
  // teacher explicitly rejects it or requests revision — prevents students
  // from overwriting a submission mid-review, and gives "awaiting review"
  // an enforced meaning rather than just a UI hint.
  const { data: existingSubmission } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("id")
    .eq("project_id", projectId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existingSubmission) {
    const { data: existingReview } = await supabase
      .schema("learning")
      .from("project_reviews")
      .select("review_status")
      .eq("submission_id", existingSubmission.id)
      .maybeSingle();

    const canResubmit = existingReview?.review_status === "rejected" || existingReview?.review_status === "revision_requested";
    if (!canResubmit) {
      throw new Error(
        existingReview?.review_status === "approved"
          ? "This project has already been approved. No resubmission is needed."
          : "Your submission is awaiting mentor review. You can resubmit once it has been reviewed."
      );
    }
  }

  let actualProgressId = progressId;
  if (!progressId || progressId === "new") {
    const { data: proj } = await supabase
      .schema("learning")
      .from("projects")
      .select("activity_id")
      .eq("id", projectId)
      .single();

    if (proj) {
      const { data: assign } = await supabase
        .schema("learning")
        .from("activity_assignments")
        .select("id")
        .eq("activity_id", proj.activity_id)
        .limit(1)
        .maybeSingle();

      if (assign) {
        const { data: prog } = await supabase
          .schema("learning")
          .from("student_activity_progress")
          .upsert({
            student_id: studentId,
            activity_id: proj.activity_id,
            activity_assignment_id: assign.id,
            status_code: "submitted",
            submitted_at: new Date().toISOString()
          }, { onConflict: "student_id,activity_assignment_id" })
          .select("id")
          .single();
        if (prog) actualProgressId = prog.id;
      }
    }
  } else {
    await supabase
      .schema("learning")
      .from("student_activity_progress")
      .update({
        status_code: "submitted",
        submitted_at: new Date().toISOString()
      })
      .eq("id", progressId);
  }

  // Insert or update submission
  const { data: submission, error } = await supabase
    .schema("learning")
    .from("project_submissions")
    .upsert({
      project_id: projectId,
      student_id: studentId,
      student_activity_progress_id: actualProgressId,
      github_url: githubUrl,
      submission_notes: notes || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "project_id,student_id" })
    .select()
    .single();

  if (error) throw error;

  // A resubmission overwrites the same submission row (unique on
  // project_id+student_id), so any prior review tied to the old content is
  // now stale — clear it so the student doesn't keep seeing an old
  // approved/rejected verdict and score for work they've since changed.
  await supabase
    .schema("learning")
    .from("project_reviews")
    .delete()
    .eq("submission_id", submission.id);

  await supabase
    .schema("learning")
    .from("student_activity_progress")
    .update({
      score: null,
      reviewed_at: null,
      reviewed_by: null,
      feedback: null
    })
    .eq("id", actualProgressId);

  const { data: proj } = await supabase
    .schema("learning")
    .from("projects")
    .select("activity_id")
    .eq("id", projectId)
    .maybeSingle();

  if (proj?.activity_id) {
    await syncCourseProgressByActivity(studentId, proj.activity_id);
  }

  return submission;
}

// ----------------------------------------------------
// Programming Challenges Operations
// ----------------------------------------------------
export async function getStudentAssignedChallenges(studentId: string) {
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

  // Combine everything
  return challenges.map(chal => {
    const act = chal.activities as any;
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
      title: act.title,
      description: act.description,
      difficulty: chal.difficulty_level,
      max_score: act.max_score,
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

  const act = (challenge as any).activities;
  if (act) {
    (challenge as any).title = act.title;
    (challenge as any).description = act.description;
    (challenge as any).instructions = act.instructions;
  }

  // Fetch or upsert progress status to 'started'
  const { data: assign } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .select("id")
    .eq("activity_id", activityId)
    .limit(1)
    .maybeSingle();

  let progress = null;
  if (assign) {
    const { data: existingProgress } = await supabase
      .schema("learning")
      .from("student_activity_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("activity_assignment_id", assign.id)
      .maybeSingle();

    if (!existingProgress) {
      const { data: newProg } = await supabase
        .schema("learning")
        .from("student_activity_progress")
        .insert({
          student_id: studentId,
          activity_id: activityId,
          activity_assignment_id: assign.id,
          status_code: "started",
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      progress = newProg;
    } else {
      progress = existingProgress;
      if (existingProgress.status_code === "assigned") {
        const { data: updatedProg } = await supabase
          .schema("learning")
          .from("student_activity_progress")
          .update({
            status_code: "started",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", existingProgress.id)
          .select()
          .single();
        progress = updatedProg;
      }
    }
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
    challenge,
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
  const supabase = await createClient();

  const { data: progress, error: progError } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .select("*")
    .eq("id", progressId)
    .eq("student_id", studentId)
    .single();

  if (progError) throw progError;

  // Idempotent: a second forfeit call for an already-closed attempt is a no-op.
  if (progress.forfeited || progress.status_code === "completed") {
    return progress;
  }

  const { data: updatedProgress } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .update({
      status_code: "failed",
      score: 0,
      completed_at: null,
      forfeited: true,
      forfeit_reason: reason,
      violation_count: (progress.violation_count || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq("id", progressId)
    .select()
    .single();

  if (progress.activity_id) {
    await syncCourseProgressByActivity(studentId, progress.activity_id);
  }

  return updatedProgress;
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

export async function getAllTestCasesInternal(challengeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("challenge_test_cases")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("position");
  if (error) throw error;
  return data || [];
}

export async function submitChallengeCode(
  challengeId: string,
  studentId: string,
  progressId: string,
  language: string,
  sourceCode: string
) {
  const supabase = await createClient();

  // Enforce Max Attempts limit
  const { data: challengeObj, error: chalFetchError } = await supabase
    .schema("learning")
    .from("programming_challenges")
    .select("activity_id, max_attempts")
    .eq("id", challengeId)
    .single();

  if (chalFetchError) throw chalFetchError;

  const { count: submissionCount, error: countError } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .eq("student_id", studentId);

  if (countError) throw countError;
  if (submissionCount !== null && submissionCount >= (challengeObj.max_attempts ?? 3)) {
    throw new Error("Maximum attempts limit reached for this coding challenge.");
  }

  const { data: passedSubmission } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("student_id", studentId)
    .eq("submission_status_code", "accepted")
    .limit(1)
    .maybeSingle();

  if (passedSubmission) {
    throw new Error("You have already passed this coding challenge. No further attempts are needed.");
  }

  let actualProgressId = progressId;
  if (!progressId || progressId === "new") {
    const { data: chal } = await supabase
      .schema("learning")
      .from("programming_challenges")
      .select("activity_id")
      .eq("id", challengeId)
      .single();

    if (chal) {
      const { data: assign } = await supabase
        .schema("learning")
        .from("activity_assignments")
        .select("id")
        .eq("activity_id", chal.activity_id)
        .limit(1)
        .maybeSingle();

      if (assign) {
        const { data: prog } = await supabase
          .schema("learning")
          .from("student_activity_progress")
          .upsert({
            student_id: studentId,
            activity_id: chal.activity_id,
            activity_assignment_id: assign.id,
            status_code: "submitted",
            submitted_at: new Date().toISOString()
          }, { onConflict: "student_id,activity_assignment_id" })
          .select("id")
          .single();
        if (prog) actualProgressId = prog.id;
      }
    }
  } else {
    await supabase
      .schema("learning")
      .from("student_activity_progress")
      .update({
        status_code: "submitted",
        submitted_at: new Date().toISOString()
      })
      .eq("id", progressId);
  }

  // 1. Create Submission
  const { data: submission, error: subError } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .insert({
      challenge_id: challengeId,
      student_id: studentId,
      student_activity_progress_id: actualProgressId,
      language,
      source_code: sourceCode,
      submission_status_code: "pending"
    })
    .select()
    .single();

  if (subError) throw subError;

  // 2. Queue for future Judge Engine execution
  const { error: qError } = await supabase
    .schema("learning")
    .from("challenge_execution_queue")
    .insert({
      submission_id: submission.id,
      status: "queued"
    });

  if (qError) throw qError;

  return submission;
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("learning")
    .from("activities")
    .select("*, activity_assignments(cohort_id)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((act: any) => ({
    ...act,
    cohort_ids: (act.activity_assignments || []).map((a: any) => a.cohort_id),
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
}) {
  const supabase = await createClient();

  if (input.quiz_strict_mode && !input.quiz_time_limit) {
    throw new Error("Strict/Proctored Mode requires a time limit to be set.");
  }

  // 1. Insert Base Activity
  const { data: activity, error: actError } = await supabase
    .schema("learning")
    .from("activities")
    .insert({
      tenant_id: input.tenant_id,
      institution_id: input.institution_id,
      lesson_id: input.lesson_id,
      activity_type_code: input.activity_type_code,
      status_code: input.status_code,
      title: input.title,
      description: input.description || null,
      instructions: input.instructions || null,
      max_score: input.max_score ?? 100,
      passing_score: input.passing_score ?? 0,
      position: input.position ?? 1,
      is_mandatory: input.is_mandatory ?? true
    })
    .select()
    .single();

  if (actError) throw actError;

  // 2. Insert Type Subclass
  if (input.activity_type_code === "quiz") {
    const { error: subError } = await supabase
      .schema("learning")
      .from("quizzes")
      .insert({
        activity_id: activity.id,
        time_limit_minutes: input.quiz_time_limit || null,
        max_attempts: input.quiz_max_attempts ?? 1,
        shuffle_questions: input.quiz_shuffle_questions ?? false,
        shuffle_options: input.quiz_shuffle_options ?? false,
        show_results_immediately: input.quiz_show_results_immediately ?? true,
        strict_mode: input.quiz_strict_mode ?? false
      });
    if (subError) throw subError;
  } else if (input.activity_type_code === "project") {
    const { error: subError } = await supabase
      .schema("learning")
      .from("projects")
      .insert({
        activity_id: activity.id,
        project_overview: input.project_overview || "",
        requirements: input.project_requirements || null,
        deliverables: input.project_deliverables || null,
        submission_instructions: input.project_submission_instructions || null,
        difficulty_level: input.project_difficulty || "intermediate",
        estimated_hours: input.project_estimated_hours || null,
        max_score: input.max_score ?? 100
      });
    if (subError) throw subError;
  } else if (input.activity_type_code === "programming_challenge" || input.activity_type_code === "programming") {
    const { error: subError } = await supabase
      .schema("learning")
      .from("programming_challenges")
      .insert({
        activity_id: activity.id,
        difficulty_level: input.chal_difficulty || "easy",
        problem_statement: input.chal_problem_statement || "",
        input_format: input.chal_input_format || null,
        output_format: input.chal_output_format || null,
        constraints_text: input.chal_constraints || null,
        starter_code: input.chal_starter_code || null,
        time_limit_ms: input.chal_time_limit || 1000,
        memory_limit_mb: input.chal_memory_limit || 256,
        strict_mode: input.chal_strict_mode ?? false
      });
    if (subError) throw subError;
  }

  return activity;
}

export async function createQuizQuestionAndOptions(
  quizId: string,
  questionText: string,
  questionType: string,
  points: number,
  position: number,
  options: Array<{ optionText: string; isCorrect: boolean; position: number }>
) {
  const supabase = await createClient();

  const { data: question, error: qError } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .insert({
      quiz_id: quizId,
      question_text: questionText,
      question_type: questionType,
      points,
      position
    })
    .select()
    .single();

  if (qError) throw qError;

  let insertedOptions: any[] = [];
  if (options.length > 0) {
    const optionsToInsert = options.map(opt => ({
      question_id: question.id,
      option_text: opt.optionText,
      is_correct: opt.isCorrect,
      position: opt.position
    }));

    const { data: optsData, error: optError } = await supabase
      .schema("learning")
      .from("quiz_options")
      .insert(optionsToInsert)
      .select();

    if (optError) throw optError;
    insertedOptions = optsData || [];
  }

  return {
    ...question,
    options: insertedOptions
  };
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
}) {
  const supabase = await createClient();

  // Validate cohort dates
  const { data: cohort, error: cohortError } = await supabase
    .schema("delivery")
    .from("cohorts")
    .select("start_date, end_date, name")
    .eq("id", input.cohort_id)
    .single();

  if (cohortError) throw new Error("Target Cohort not found.");

  if (cohort) {
    const start = cohort.start_date ? new Date(cohort.start_date) : null;
    const end = cohort.end_date ? new Date(cohort.end_date) : null;

    if (input.available_from) {
      const fromDate = new Date(input.available_from);
      if (start && fromDate < start) {
        throw new Error(`Available From date (${fromDate.toLocaleDateString()}) cannot be before cohort start date (${start.toLocaleDateString()}).`);
      }
      if (end && fromDate > end) {
        throw new Error(`Available From date (${fromDate.toLocaleDateString()}) cannot be after cohort end date (${end.toLocaleDateString()}).`);
      }
    }
    if (input.available_until) {
      const untilDate = new Date(input.available_until);
      if (start && untilDate < start) {
        throw new Error(`Available Until date (${untilDate.toLocaleDateString()}) cannot be before cohort start date (${start.toLocaleDateString()}).`);
      }
      if (end && untilDate > end) {
        throw new Error(`Available Until date (${untilDate.toLocaleDateString()}) cannot be after cohort end date (${end.toLocaleDateString()}).`);
      }
    }
    if (input.available_from && input.available_until) {
      const fromDate = new Date(input.available_from);
      const untilDate = new Date(input.available_until);
      if (fromDate > untilDate) {
        throw new Error("Available From date cannot be after Available Until date.");
      }
    }
  }

  const { data, error } = await supabase
    .schema("learning")
    .from("activity_assignments")
    .insert({
      activity_id: input.activity_id,
      cohort_id: input.cohort_id,
      is_required: input.is_required ?? true,
      available_from: input.available_from || null,
      available_until: input.available_until || null,
      created_by: input.created_by || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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
  const supabase = await createClient();

  if (input.activity_type_code === "quiz" && input.quiz_strict_mode && !input.quiz_time_limit) {
    throw new Error("Strict/Proctored Mode requires a time limit to be set.");
  }

  // Validate and update assignments if any
  if (input.assignments && input.assignments.length > 0) {
    for (const assign of input.assignments) {
      // Validate cohort dates
      const { data: cohort } = await supabase
        .schema("delivery")
        .from("cohorts")
        .select("start_date, end_date")
        .eq("id", assign.cohort_id)
        .single();

      if (cohort) {
        const start = cohort.start_date ? new Date(cohort.start_date) : null;
        const end = cohort.end_date ? new Date(cohort.end_date) : null;

        if (assign.available_from) {
          const fromDate = new Date(assign.available_from);
          if (start && fromDate < start) {
            throw new Error(`Available From date (${fromDate.toLocaleDateString()}) cannot be before cohort start date (${start.toLocaleDateString()}).`);
          }
          if (end && fromDate > end) {
            throw new Error(`Available From date (${fromDate.toLocaleDateString()}) cannot be after cohort end date (${end.toLocaleDateString()}).`);
          }
        }
        if (assign.available_until) {
          const untilDate = new Date(assign.available_until);
          if (start && untilDate < start) {
            throw new Error(`Available Until date (${untilDate.toLocaleDateString()}) cannot be before cohort start date (${start.toLocaleDateString()}).`);
          }
          if (end && untilDate > end) {
            throw new Error(`Available Until date (${untilDate.toLocaleDateString()}) cannot be after cohort end date (${end.toLocaleDateString()}).`);
          }
        }
        if (assign.available_from && assign.available_until) {
          const fromDate = new Date(assign.available_from);
          const untilDate = new Date(assign.available_until);
          if (fromDate > untilDate) {
            throw new Error("Available From date cannot be after Available Until date.");
          }
        }
      }

      // Update the assignment in database
      const { error: assignUpdateError } = await supabase
        .schema("learning")
        .from("activity_assignments")
        .update({
          available_from: assign.available_from || null,
          available_until: assign.available_until || null,
          is_required: assign.is_required ?? true,
          updated_at: new Date().toISOString()
        })
        .eq("id", assign.id);

      if (assignUpdateError) throw assignUpdateError;
    }
  }

  // 1. Update Base Activity
  const { data: activity, error: actError } = await supabase
    .schema("learning")
    .from("activities")
    .update({
      title: input.title,
      description: input.description || null,
      instructions: input.instructions || null,
      max_score: input.max_score ?? 100,
      passing_score: input.passing_score ?? 0,
      is_mandatory: input.is_mandatory ?? true,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (actError) throw actError;

  // 2. Update Type Subclass
  if (input.activity_type_code === "quiz") {
    const { error: subError } = await supabase
      .schema("learning")
      .from("quizzes")
      .update({
        time_limit_minutes: input.quiz_time_limit || null,
        max_attempts: input.quiz_max_attempts ?? 1,
        shuffle_questions: input.quiz_shuffle_questions ?? false,
        shuffle_options: input.quiz_shuffle_options ?? false,
        show_results_immediately: input.quiz_show_results_immediately ?? true,
        strict_mode: input.quiz_strict_mode ?? false,
        updated_at: new Date().toISOString()
      })
      .eq("activity_id", id);
    if (subError) throw subError;
  } else if (input.activity_type_code === "project") {
    const { error: subError } = await supabase
      .schema("learning")
      .from("projects")
      .update({
        project_overview: input.project_overview || "",
        requirements: input.project_requirements || null,
        deliverables: input.project_deliverables || null,
        submission_instructions: input.project_submission_instructions || null,
        difficulty_level: input.project_difficulty || "intermediate",
        estimated_hours: input.project_estimated_hours || null,
        max_score: input.max_score ?? 100,
        updated_at: new Date().toISOString()
      })
      .eq("activity_id", id);
    if (subError) throw subError;
  } else if (input.activity_type_code === "programming_challenge" || input.activity_type_code === "programming") {
    const { error: subError } = await supabase
      .schema("learning")
      .from("programming_challenges")
      .update({
        difficulty_level: input.chal_difficulty || "easy",
        problem_statement: input.chal_problem_statement || "",
        input_format: input.chal_input_format || null,
        output_format: input.chal_output_format || null,
        constraints_text: input.chal_constraints || null,
        starter_code: input.chal_starter_code || null,
        time_limit_ms: input.chal_time_limit || 1000,
        memory_limit_mb: input.chal_memory_limit || 256,
        strict_mode: input.chal_strict_mode ?? false,
        updated_at: new Date().toISOString()
      })
      .eq("activity_id", id);
    if (subError) throw subError;
  }

  return activity;
}

// ----------------------------------------------------
// Teacher Dashboard Operations
// ----------------------------------------------------
export async function listProjectSubmissions(tenantId: string) {
  const supabase = await createClient();

  const { data: projects, error: projError } = await supabase
    .schema("learning")
    .from("projects")
    .select(`
      id,
      activity_id,
      max_score,
      activities!inner (
        id,
        title,
        tenant_id
      )
    `)
    .eq("activities.tenant_id", tenantId);

  if (projError) throw projError;
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);

  const { data: submissions, error: subError } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("*")
    .in("project_id", projectIds)
    .order("submitted_at", { ascending: false });

  if (subError) throw subError;
  if (!submissions || submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);
  const { data: reviews } = await supabase
    .schema("learning")
    .from("project_reviews")
    .select("*")
    .in("submission_id", submissionIds);

  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: students } = await supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", studentIds);

  return submissions.map(sub => {
    const project: any = projects.find(p => p.id === sub.project_id);
    const review = reviews?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      project_title: project?.activities?.title || "Unknown Project",
      max_score: Number(project?.max_score || 100),
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
  const supabase = await createClient();

  const { data: submission, error: subError } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("*")
    .eq("id", input.submissionId)
    .single();

  if (subError || !submission) throw new Error("Project submission not found.");

  const { data: review, error: revError } = await supabase
    .schema("learning")
    .from("project_reviews")
    .upsert({
      submission_id: input.submissionId,
      reviewed_by: input.reviewerId,
      score: input.score,
      feedback: input.feedback,
      review_status: input.status,
      reviewed_at: new Date().toISOString()
    }, { onConflict: "submission_id" })
    .select()
    .single();

  if (revError) throw revError;

  let progressStatus = "review_pending";
  if (input.status === "approved") {
    progressStatus = "completed";
  } else if (input.status === "revision_requested") {
    progressStatus = "started";
  } else if (input.status === "rejected") {
    progressStatus = "failed";
  }

  const { error: progError } = await supabase
    .schema("learning")
    .from("student_activity_progress")
    .update({
      status_code: progressStatus,
      score: input.score,
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.reviewerId,
      feedback: input.feedback,
      updated_at: new Date().toISOString()
    })
    .eq("id", submission.student_activity_progress_id);

  if (progError) throw progError;

  const { data: proj } = await supabase
    .schema("learning")
    .from("projects")
    .select("activity_id")
    .eq("id", submission.project_id)
    .maybeSingle();

  if (proj?.activity_id) {
    await syncCourseProgressByActivity(submission.student_id, proj.activity_id);
  }

  return review;
}

export async function listChallengeSubmissions(tenantId: string) {
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
    const challenge: any = challenges.find(c => c.id === sub.challenge_id);
    const result = results?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      challenge_title: challenge?.activities?.title || "Unknown Challenge",
      max_score: Number(challenge?.activities?.max_score || 100),
      student,
      result
    };
  });
}

export async function ensureLessonProjectActivity(lessonId: string, studentId: string, courseId: string) {
  const supabase = await createClient();

  // 1. Check if activity already exists for this lesson
  let { data: activity, error: actError } = await supabase
    .schema("learning")
    .from("activities")
    .select("*")
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .maybeSingle();

  if (actError) throw actError;

  // 2. If it does not exist, query the lesson info
  if (!activity) {
    const { data: lesson, error: lesError } = await supabase
      .schema("academic")
      .from("lessons")
      .select("title, tenant_id, institution_id")
      .eq("id", lessonId)
      .single();

    if (lesError) throw lesError;
    if (!lesson) throw new Error("Lesson not found");

    // Insert new published activity of type "assignment" or "project"
    const { data: newAct, error: createActError } = await supabase
      .schema("learning")
      .from("activities")
      .insert({
        tenant_id: lesson.tenant_id,
        institution_id: lesson.institution_id,
        lesson_id: lessonId,
        activity_type_code: "assignment", // default type
        status_code: "published",
        title: lesson.title,
        description: `Hands-on submission for ${lesson.title}`,
        max_score: 100,
        passing_score: 50,
        is_mandatory: true
      })
      .select()
      .single();

    if (createActError) throw createActError;
    activity = newAct;
  }

  if (!activity) throw new Error("Failed to resolve activity");

  // 3. Make sure projects entry exists for this activity
  let { data: project, error: projError } = await supabase
    .schema("learning")
    .from("projects")
    .select("*")
    .eq("activity_id", activity.id)
    .maybeSingle();

  if (projError) throw projError;

  if (!project) {
    const { data: newProj, error: createProjError } = await supabase
      .schema("learning")
      .from("projects")
      .insert({
        activity_id: activity.id,
        project_overview: `Please complete the assignment details for ${activity.title} and submit your GitHub URL repository link.`,
        requirements: "Complete all guidelines described in the lesson curriculum.",
        deliverables: "GitHub repository URL.",
        difficulty_level: "intermediate",
        estimated_hours: 4,
        max_score: 100
      })
      .select()
      .single();

    if (createProjError) throw createProjError;
    project = newProj;
  }

  // 4. Ensure activity assignment exists for student's cohort(s)
  // Fetch student's active cohorts
  const { data: enrollments } = await supabase
    .schema("delivery")
    .from("enrollments")
    .select("cohort_id")
    .eq("user_id", studentId)
    .eq("status_code", "active")
    .is("deleted_at", null);

  const cohortIds = (enrollments || []).map(e => e.cohort_id);

  if (cohortIds.length > 0) {
    for (const cohortId of cohortIds) {
      // Check if assignment already exists
      const { data: assign } = await supabase
        .schema("learning")
        .from("activity_assignments")
        .select("id")
        .eq("activity_id", activity.id)
        .eq("cohort_id", cohortId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!assign) {
        // Insert assignment for this cohort
        await supabase
          .schema("learning")
          .from("activity_assignments")
          .insert({
            activity_id: activity.id,
            cohort_id: cohortId,
            is_required: true,
            available_from: new Date().toISOString()
          });
      }
    }
  }

  return { success: true, activityId: activity.id };
}

export async function listCohortProjectSubmissions(cohortId: string) {
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

  const { data: projects, error: projError } = await supabase
    .schema("learning")
    .from("projects")
    .select(`
      id,
      activity_id,
      max_score,
      activities!inner (
        id,
        title
      )
    `)
    .in("activity_id", activityIds);

  if (projError) throw projError;
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);

  const { data: submissions, error: subError } = await supabase
    .schema("learning")
    .from("project_submissions")
    .select("*")
    .in("project_id", projectIds)
    .order("submitted_at", { ascending: false });

  if (subError) throw subError;
  if (!submissions || submissions.length === 0) return [];

  const submissionIds = submissions.map(s => s.id);
  const { data: reviews } = await supabase
    .schema("learning")
    .from("project_reviews")
    .select("*")
    .in("submission_id", submissionIds);

  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: students } = await supabase
    .schema("core")
    .from("users")
    .select("id, full_name, email")
    .in("id", studentIds);

  return submissions.map(sub => {
    const project: any = projects.find(p => p.id === sub.project_id);
    const review = reviews?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      project_title: project?.activities?.title || "Unknown Project",
      max_score: Number(project?.max_score || 100),
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
    const challenge: any = challenges.find(c => c.id === sub.challenge_id);
    const result = results?.find(r => r.submission_id === sub.id) || null;
    const student = students?.find(s => s.id === sub.student_id) || null;

    return {
      ...sub,
      challenge_title: challenge?.activities?.title || "Unknown Challenge",
      max_score: Number(challenge?.activities?.max_score || 100),
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
    const quiz: any = quizzes.find(q => q.id === att.quiz_id);
    const student = students?.find(s => s.id === att.student_id) || null;

    return {
      ...att,
      quiz_title: quiz?.activities?.title || "Unknown Quiz",
      max_score: Number(quiz?.activities?.max_score || 100),
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
  const supabase = await createClient();
  
  const { error: qError } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .update({
      question_text: questionText,
      question_type: questionType,
      points,
      updated_at: new Date().toISOString()
    })
    .eq("id", questionId);
    
  if (qError) throw qError;

  const { error: dError } = await supabase
    .schema("learning")
    .from("quiz_options")
    .delete()
    .eq("question_id", questionId);
    
  if (dError) throw dError;
  
  let insertedOptions: any[] = [];
  if (options.length > 0) {
    const { data: optsData, error: iError } = await supabase
      .schema("learning")
      .from("quiz_options")
      .insert(
        options.map(o => ({
          question_id: questionId,
          option_text: o.optionText,
          is_correct: o.isCorrect,
          position: o.position
        }))
      )
      .select();
      
    if (iError) throw iError;
    insertedOptions = optsData || [];
  }
  
  const { data: updatedQ } = await supabase
    .schema("learning")
    .from("quiz_questions")
    .select("*")
    .eq("id", questionId)
    .single();
    
  return {
    ...updatedQ,
    options: insertedOptions
  };
}


