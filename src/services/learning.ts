import { createClient } from "@/utils/supabase/server";

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

  // 5. Combine everything
  return activities.map(act => {
    const assignment = assignments.find(a => a.activity_id === act.id);
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

    return {
      ...act,
      assignment: {
        id: assignment?.id,
        cohort_id: assignment?.cohort_id,
        available_from: assignment?.available_from,
        available_until: assignment?.available_until,
        is_required: assignment?.is_required ?? true
      },
      progress
    };
  });
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
    .select("time_limit_minutes")
    .eq("id", quizId)
    .single();

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
      .select("id, question_id, option_text, position")
      .in("question_id", questionIds)
      .order("position", { ascending: true });

    if (optError) throw optError;
    options = optData || [];
  }

  // Map options to questions
  let quizQuestionsList = (questions || []).map(q => ({
    ...q,
    options: options.filter(o => o.question_id === q.id)
  }));

  // Apply shuffling if configuration permits (seeded by attemptId)
  if (quiz.shuffle_questions) {
    quizQuestionsList = shuffleArray(quizQuestionsList, attemptId);
  }
  if (quiz.shuffle_options) {
    quizQuestionsList = quizQuestionsList.map(q => ({
      ...q,
      options: shuffleArray(q.options, attemptId + q.id)
    }));
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
      attempt_number: (count || 0) + 1,
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

  return {
    challenge,
    progress,
    examples: examples || [],
    submissions: submissions || []
  };
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
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
}) {
  const supabase = await createClient();

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
        show_results_immediately: input.quiz_show_results_immediately ?? true
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
        memory_limit_mb: input.chal_memory_limit || 256
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

  if (options.length > 0) {
    const optionsToInsert = options.map(opt => ({
      question_id: question.id,
      option_text: opt.optionText,
      is_correct: opt.isCorrect,
      position: opt.position
    }));

    const { error: optError } = await supabase
      .schema("learning")
      .from("quiz_options")
      .insert(optionsToInsert);

    if (optError) throw optError;
  }

  return question;
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

  assignments?: Array<{
    id: string;
    available_from?: string;
    available_until?: string;
    is_required?: boolean;
    cohort_id: string;
  }>;
}) {
  const supabase = await createClient();

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

