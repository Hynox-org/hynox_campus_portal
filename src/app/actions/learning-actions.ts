"use server";

import * as service from "@/services/learning";
import { revalidatePath } from "next/cache";

export async function getStudentAssignedActivitiesAction(studentId: string) {
  try {
    const activities = await service.getStudentAssignedActivities(studentId);
    return { activities };
  } catch (error: any) {
    return { error: error.message || "Failed to load assigned activities." };
  }
}

export async function getQuizDetailsAction(activityId: string) {
  try {
    const data = await service.getQuizDetails(activityId);
    return data;
  } catch (error: any) {
    return { error: error.message || "Failed to load quiz details." };
  }
}

export async function startQuizAttemptAction(quizId: string, studentId: string, progressId: string, attemptNumber: number = 1) {
  try {
    const attempt = await service.startQuizAttempt(quizId, studentId, progressId, attemptNumber);
    revalidatePath("/student");
    return { attempt };
  } catch (error: any) {
    return { error: error.message || "Failed to start quiz attempt." };
  }
}

export async function submitQuizAnswersAction(
  attemptId: string,
  answers: Array<{ questionId: string; selectedOptionId?: string; answerText?: string }>
) {
  try {
    const attempt = await service.submitQuizAnswers(attemptId, answers);
    revalidatePath("/student");
    return { attempt };
  } catch (error: any) {
    return { error: error.message || "Failed to submit quiz answers." };
  }
}

export async function getProjectDetailsAction(activityId: string, studentId: string) {
  try {
    const data = await service.getProjectDetails(activityId, studentId);
    return data;
  } catch (error: any) {
    return { error: error.message || "Failed to load project details." };
  }
}

export async function submitProjectAction(
  projectId: string,
  studentId: string,
  progressId: string,
  githubUrl: string,
  notes?: string
) {
  try {
    const submission = await service.submitProject(projectId, studentId, progressId, githubUrl, notes);
    revalidatePath("/student");
    return { submission };
  } catch (error: any) {
    return { error: error.message || "Failed to submit project." };
  }
}

export async function getStudentAssignedChallengesAction(studentId: string) {
  try {
    const challenges = await service.getStudentAssignedChallenges(studentId);
    return { challenges };
  } catch (error: any) {
    return { error: error.message || "Failed to load assigned challenges." };
  }
}

export async function getProgrammingChallengeDetailsAction(activityId: string, studentId: string) {
  try {
    const data = await service.getProgrammingChallengeDetails(activityId, studentId);
    return data;
  } catch (error: any) {
    return { error: error.message || "Failed to load programming challenge." };
  }
}

export async function runChallengeCodeAction(
  challengeId: string,
  language: string,
  sourceCode: string
) {
  try {
    const runner = await import("@/services/runner");
    const results = await runner.executeVisibleTests(challengeId, language, sourceCode);
    return { results };
  } catch (error: any) {
    return { error: error.message || "Failed to run challenge code." };
  }
}

export async function submitChallengeCodeAction(
  challengeId: string,
  studentId: string,
  progressId: string,
  language: string,
  sourceCode: string
) {
  try {
    const submission = await service.submitChallengeCode(challengeId, studentId, progressId, language, sourceCode);
    
    // Automatically trigger Judge Engine execution in background only if external worker process is disabled
    if (process.env.JUDGE_WORKER_ENABLED !== "true") {
      const runner = await import("@/services/runner");
      runner.executeAllTestsAndGrade(submission.id).catch(console.error);
    }

    revalidatePath("/student");
    return { submission };
  } catch (error: any) {
    return { error: error.message || "Failed to submit challenge code." };
  }
}

export async function getChallengeSubmissionResultsAction(submissionId: string) {
  try {
    const data = await service.getChallengeSubmissionResults(submissionId);
    return data;
  } catch (error: any) {
    return { error: error.message || "Failed to load submission results." };
  }
}

// Server action to list all activities for a tenant (force recompilation refresh)
export async function listAllActivitiesAction(tenantId: string) {
  try {
    const activities = await service.listAllActivities(tenantId);
    return { activities };
  } catch (error: any) {
    return { error: error.message || "Failed to list activities." };
  }
}

export async function createActivityAndSubclassAction(input: any) {
  try {
    const activity = await service.createActivityAndSubclass(input);
    revalidatePath("/admin");
    return { activity };
  } catch (error: any) {
    return { error: error.message || "Failed to create activity." };
  }
}

export async function createQuizQuestionAndOptionsAction(
  quizId: string,
  questionText: string,
  questionType: string,
  points: number,
  position: number,
  options: Array<{ optionText: string; isCorrect: boolean; position: number }>
) {
  try {
    const question = await service.createQuizQuestionAndOptions(
      quizId,
      questionText,
      questionType,
      points,
      position,
      options
    );
    revalidatePath("/admin");
    return { question };
  } catch (error: any) {
    return { error: error.message || "Failed to create question." };
  }
}

export async function createChallengeExampleAction(input: any) {
  try {
    const example = await service.createChallengeExample(input);
    revalidatePath("/admin");
    return { example };
  } catch (error: any) {
    return { error: error.message || "Failed to create challenge example." };
  }
}

export async function createChallengeTestCaseAction(input: any) {
  try {
    const testCase = await service.createChallengeTestCase(input);
    revalidatePath("/admin");
    return { testCase };
  } catch (error: any) {
    return { error: error.message || "Failed to create test case." };
  }
}

export async function assignActivityToCohortAction(input: any) {
  try {
    const assignment = await service.assignActivityToCohort(input);
    revalidatePath("/admin");
    return { assignment };
  } catch (error: any) {
    return { error: error.message || "Failed to assign activity." };
  }
}

export async function getActiveQuizAttemptAction(quizId: string, studentId: string) {
  try {
    const attempt = await service.getActiveQuizAttempt(quizId, studentId);
    return { attempt };
  } catch (error: any) {
    return { error: error.message || "Failed to check active attempt." };
  }
}

export async function getQuizSessionDetailsAction(attemptId: string) {
  try {
    const data = await service.getQuizSessionDetails(attemptId);
    return data;
  } catch (error: any) {
    return { error: error.message || "Failed to retrieve quiz session details." };
  }
}

export async function listProjectSubmissionsAction(tenantId: string) {
  try {
    const submissions = await service.listProjectSubmissions(tenantId);
    return { submissions };
  } catch (error: any) {
    return { error: error.message || "Failed to load project submissions." };
  }
}

export async function reviewProjectSubmissionAction(input: {
  submissionId: string;
  reviewerId: string;
  status: string;
  score: number;
  feedback: string;
}) {
  try {
    const review = await service.reviewProjectSubmission(input);
    revalidatePath("/teacher");
    return { review };
  } catch (error: any) {
    return { error: error.message || "Failed to submit project review." };
  }
}

export async function listChallengeSubmissionsAction(tenantId: string) {
  try {
    const submissions = await service.listChallengeSubmissions(tenantId);
    return { submissions };
  } catch (error: any) {
    return { error: error.message || "Failed to load challenge submissions." };
  }
}

import { createClient } from "@/utils/supabase/server";

export async function getActivityDetailsNoStudentAction(activityId: string, activityType: string) {
  try {
    const supabase = await createClient();
    
    const { data: assignments } = await supabase
      .schema("learning")
      .from("activity_assignments")
      .select("*")
      .eq("activity_id", activityId)
      .is("deleted_at", null);

    if (activityType === "quiz") {
      const { data: quiz, error: qError } = await supabase
        .schema("learning")
        .from("quizzes")
        .select("*")
        .eq("activity_id", activityId)
        .maybeSingle();
      if (qError) throw qError;
      if (!quiz) return { error: "Quiz not found" };

      const { data: questions, error: questError } = await supabase
        .schema("learning")
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("position", { ascending: true });
      if (questError) throw questError;

      const questionIds = (questions || []).map(q => q.id);
      let options: any[] = [];
      if (questionIds.length > 0) {
        const { data: optData } = await supabase
          .schema("learning")
          .from("quiz_options")
          .select("*")
          .in("question_id", questionIds)
          .order("position", { ascending: true });
        options = optData || [];
      }

      return {
        quiz,
        assignments: assignments || [],
        questions: (questions || []).map(q => ({
          ...q,
          options: options.filter(o => o.question_id === q.id)
        }))
      };
    } else if (activityType === "project") {
      const { data: project, error: pError } = await supabase
        .schema("learning")
        .from("projects")
        .select("*")
        .eq("activity_id", activityId)
        .maybeSingle();
      if (pError) throw pError;
      return { project, assignments: assignments || [] };
    } else if (activityType === "programming") {
      const { data: challenge, error: cError } = await supabase
        .schema("learning")
        .from("programming_challenges")
        .select("*")
        .eq("activity_id", activityId)
        .maybeSingle();
      if (cError) throw cError;
      if (!challenge) return { error: "Challenge not found" };

      const { data: examples } = await supabase
        .schema("learning")
        .from("challenge_examples")
        .select("*")
        .eq("challenge_id", challenge.id)
        .order("example_number", { ascending: true });

      const { data: testCases } = await supabase
        .schema("learning")
        .from("challenge_test_cases")
        .select("*")
        .eq("challenge_id", challenge.id)
        .order("position", { ascending: true });

      return {
        challenge,
        assignments: assignments || [],
        examples: examples || [],
        testCases: testCases || []
      };
    }
    return { error: "Unknown activity type" };
  } catch (error: any) {
    return { error: error.message || "Failed to load activity details." };
  }
}

export async function listActivityProgressAction(activityId: string) {
  try {
    const supabase = await createClient();
    
    const { data: assignments, error: assignError } = await supabase
      .schema("learning")
      .from("activity_assignments")
      .select("id")
      .eq("activity_id", activityId)
      .is("deleted_at", null);
      
    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) return { progress: [] };
    
    const assignIds = assignments.map(a => a.id);
    const { data: progress, error: progError } = await supabase
      .schema("learning")
      .from("student_activity_progress")
      .select("*")
      .in("activity_assignment_id", assignIds)
      .order("updated_at", { ascending: false });
      
    if (progError) throw progError;
    if (!progress || progress.length === 0) return { progress: [] };
    
    const studentIds = [...new Set(progress.map(p => p.student_id))];
    const { data: students } = await supabase
      .schema("core")
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);
      
    return {
      progress: progress.map(p => ({
        ...p,
        student: students?.find(s => s.id === p.student_id) || null
      }))
    };
  } catch (error: any) {
    return { error: error.message || "Failed to load activity progress." };
  }
}

export async function listQuizAttemptsAction(tenantId: string) {
  try {
    const supabase = await createClient();
    const { data: quizzes, error: qError } = await supabase
      .schema("learning")
      .from("quizzes")
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

    if (qError) throw qError;
    if (!quizzes || quizzes.length === 0) return { attempts: [] };

    const quizIds = quizzes.map(q => q.id);

    const { data: attempts, error: attError } = await supabase
      .schema("learning")
      .from("quiz_attempts")
      .select("*")
      .in("quiz_id", quizIds)
      .order("submitted_at", { ascending: false });

    if (attError) throw attError;
    if (!attempts || attempts.length === 0) return { attempts: [] };

    const studentIds = [...new Set(attempts.map(a => a.student_id))];
    const { data: students } = await supabase
      .schema("core")
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);

    return {
      attempts: attempts.map(att => {
        const quiz: any = quizzes.find(q => q.id === att.quiz_id);
        const student = students?.find(s => s.id === att.student_id) || null;

        return {
          ...att,
          quiz_title: quiz?.activities?.title || "Unknown Quiz",
          max_score: Number(quiz?.activities?.max_score || 100),
          student,
          activity_id: quiz?.activity_id
        };
      })
    };
  } catch (error: any) {
    return { error: error.message || "Failed to load quiz attempts." };
  }
}

export async function updateActivityAndSubclassAction(id: string, input: any) {
  try {
    const activity = await service.updateActivityAndSubclass(id, input);
    revalidatePath("/admin");
    return { success: true, activity };
  } catch (error: any) {
    return { error: error.message || "Failed to update learning activity." };
  }
}

export async function ensureLessonProjectActivityAction(lessonId: string, studentId: string, courseId: string) {
  try {
    const res = await service.ensureLessonProjectActivity(lessonId, studentId, courseId);
    revalidatePath("/student");
    return res;
  } catch (error: any) {
    return { error: error.message || "Failed to ensure dynamic lesson activity." };
  }
}

export async function deleteChallengeExampleAction(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .schema("learning")
      .from("challenge_examples")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/admin");
    revalidatePath("/teacher");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete challenge example." };
  }
}

export async function deleteChallengeTestCaseAction(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .schema("learning")
      .from("challenge_test_cases")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/admin");
    revalidatePath("/teacher");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete challenge test case." };
  }
}
