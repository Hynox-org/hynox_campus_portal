import { createClient } from "@/utils/supabase/server";
import { validateInstitutionId } from "@/lib/institution-validation";
import type { Row } from "@/types/database-rows";

export type QuizAnswer = { questionId: string; selectedOptionId?: string; answerText?: string };
import type { QuizQuestion } from "@/types/campus";
export type QuizContent = { quiz: Row<"learning.quizzes"> & { allowed_attempts?: number }; attempt: Row<"learning.quiz_attempts"> | null; questions: QuizQuestion[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAttempt(value: unknown): value is Row<"learning.quiz_attempts"> {
  return isObject(value) && typeof value.id === "string" && typeof value.quiz_id === "string" &&
    typeof value.student_id === "string" && typeof value.student_activity_progress_id === "string" &&
    Number.isInteger(value.attempt_number) && typeof value.started_at === "string" &&
    (value.submitted_at === null || typeof value.submitted_at === "string") &&
    (value.score === null || typeof value.score === "number") && (value.max_score === null || typeof value.max_score === "number") &&
    (value.passed === null || typeof value.passed === "boolean") && typeof value.forfeited === "boolean";
}

export async function startQuiz(quizId: string, studentId: string, progressId?: string) {
  validateInstitutionId(quizId);validateInstitutionId(studentId);
  if (progressId && progressId !== "new") validateInstitutionId(progressId);
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("start_quiz", {
    p_quiz_id: quizId, p_student_id: studentId, p_progress_id: progressId && progressId !== "new" ? progressId : null,
  });
  if (error) throw error;
  if (!isAttempt(data) || data.quiz_id !== quizId || data.student_id !== studentId) throw new Error("Invalid quiz attempt response.");
  return data;
}

export async function finishQuiz(attemptId: string, answers: QuizAnswer[], reason?: string) {
  validateInstitutionId(attemptId);
  if (!Array.isArray(answers) || answers.length > 5000) throw new Error("Invalid quiz answers.");
  for (const answer of answers) {
    if (!isObject(answer)) throw new Error("Invalid quiz answers.");
    validateInstitutionId(answer.questionId);
    if (answer.selectedOptionId !== undefined) validateInstitutionId(answer.selectedOptionId);
    if (answer.answerText !== undefined && (typeof answer.answerText !== "string" || answer.answerText.length > 10000)) throw new Error("Invalid answer text.");
  }
  if (reason !== undefined && (typeof reason !== "string" || !reason.trim() || reason.length > 200)) throw new Error("Invalid forfeit reason.");
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("finish_quiz", {
    p_attempt_id: attemptId, p_answers: answers, p_forfeit_reason: reason ?? null,
  });
  if (error) throw error;
  if (!isAttempt(data) || data.id !== attemptId) throw new Error("Invalid quiz attempt response.");
  return data;
}

export async function approveRetake(attemptId: string) {
  validateInstitutionId(attemptId);
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("approve_quiz_retake", { p_attempt_id: attemptId });
  if (error) throw error;
  if (!isObject(data) || data.success !== true) throw new Error("Retake approval was not confirmed.");
  return { success: true };
}

function isQuestion(q: unknown): q is QuizQuestion {
  return isObject(q) && typeof q.id === "string" && typeof q.quiz_id === "string" &&
    typeof q.question_text === "string" && typeof q.question_type === "string" && Array.isArray(q.options) &&
    q.options.every(o => isObject(o) && typeof o.id === "string" && typeof o.option_text === "string");
}

function isContent(value: unknown): value is QuizContent {
  return isObject(value) && isObject(value.quiz) && typeof value.quiz.id === "string" &&
    typeof value.quiz.activity_id === "string" && (value.attempt === null || isAttempt(value.attempt)) &&
    Array.isArray(value.questions) && value.questions.every(isQuestion);
}

export async function quizContent(activityId: string, attemptId?: string, staff = false) {
  validateInstitutionId(activityId);
  if (attemptId) validateInstitutionId(attemptId);
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("quiz_content", {
    p_activity_id: activityId, p_attempt_id: attemptId ?? null, p_staff: staff,
  });
  if (error) throw error;
  if (!isContent(data) || data.quiz.activity_id !== activityId || (attemptId && data.attempt?.id !== attemptId)) throw new Error("Invalid quiz content response.");
  return data;
}

export async function saveQuizQuestion(quizId: string, questionId: string | null, text: string, type: string,
  points: number, position: number, options: Array<{ optionText: string; isCorrect: boolean; position: number }>) {
  validateInstitutionId(quizId);
  if (questionId) validateInstitutionId(questionId);
  const db = await createClient();
  const { data, error } = await db.schema("learning").rpc("save_quiz_question", {
    p_quiz_id: quizId, p_question_id: questionId, p_text: text, p_type: type,
    p_points: points, p_position: position, p_options: options,
  });
  if (error) throw error;
  if (!isQuestion(data) || data.quiz_id !== quizId) throw new Error("Question save was not confirmed.");
  return data;
}
