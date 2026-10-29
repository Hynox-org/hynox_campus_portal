import { createClient } from "@/utils/supabase/server";
import type { LessonProgress } from "@/types/campus";

export interface CourseProgressSnapshot {
  user_id: string;
  course_id: string;
  completed_lessons: number;
  total_lessons: number;
  completed_activities: number;
  total_activities: number;
  progress_percentage: number;
  status_code: "not_started" | "in_progress" | "completed";
  started_at?: string | null;
  completed_at?: string | null;
}

/** Fail visibly on an incomplete/changed RPC contract instead of showing false 100%. */
export function parseProgressSnapshot(value: unknown): CourseProgressSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid course progress response.");
  const row = value as Record<string, unknown>;
  const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (typeof row.user_id !== "string" || typeof row.course_id !== "string" ||
      !count(row.completed_lessons) || !count(row.total_lessons) || !count(row.completed_activities) || !count(row.total_activities) ||
      typeof row.progress_percentage !== "number" || !Number.isFinite(row.progress_percentage) ||
      (row.status_code !== "not_started" && row.status_code !== "in_progress" && row.status_code !== "completed")) {
    throw new Error("Invalid course progress response.");
  }
  const result: CourseProgressSnapshot = {
    user_id: row.user_id, course_id: row.course_id, completed_lessons: row.completed_lessons, total_lessons: row.total_lessons,
    completed_activities: row.completed_activities, total_activities: row.total_activities,
    progress_percentage: row.progress_percentage, status_code: row.status_code,
    started_at: typeof row.started_at === "string" ? row.started_at : null,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
  };
  const total = result.total_lessons + result.total_activities;
  const completed = result.completed_lessons + result.completed_activities;
  const expected = total ? (completed === total ? 100 : Math.min(99.99, Math.round(10000 * completed / total) / 100)) : 0;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(completed) || result.completed_lessons > result.total_lessons || result.completed_activities > result.total_activities ||
      result.progress_percentage !== expected ||
      (result.status_code === "completed" && (!total || completed !== total))) throw new Error("Inconsistent course progress response.");
  return result;
}

/** One bounded RPC for every requested course, without writes during page loads. */
export async function readProgressSnapshots(studentIds: string[], courseIds: string[], client?: Awaited<ReturnType<typeof createClient>>) {
  if (!studentIds.length || !courseIds.length) return [];
  const db = client || await createClient();
  const students = [...new Set(studentIds)];
  const courses = [...new Set(courseIds)];
  const batches: Array<{ p_student_ids: string[]; p_course_ids: string[] }> = [];
  for (let user = 0; user < students.length; user += 50) {
    for (let course = 0; course < courses.length; course += 100) {
      batches.push({ p_student_ids: students.slice(user, user + 50), p_course_ids: courses.slice(course, course + 100) });
    }
  }
  const snapshots: CourseProgressSnapshot[] = [];
  for (let index = 0; index < batches.length; index += 4) {
    const results = await Promise.all(batches.slice(index, index + 4).map(async batch => {
      const { data, error } = await db.schema("delivery").rpc("course_progress_snapshot", batch);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Invalid course progress response.");
      return data.map(parseProgressSnapshot);
    }));
    snapshots.push(...results.flat());
  }
  return snapshots;
}

export async function refreshProgressSnapshot(studentId: string, courseId: string, client?: Awaited<ReturnType<typeof createClient>>) {
  const db = client || await createClient();
  const { data, error } = await db.schema("delivery").rpc("refresh_course_progress", { p_student_id: studentId, p_course_id: courseId });
  if (error) throw error;
  return parseProgressSnapshot(data);
}

export async function setLessonProgress(studentId: string, lessonId: string, courseId: string, complete: boolean): Promise<LessonProgress> {
  const db = await createClient();
  const { data, error } = await db.schema("delivery").rpc("set_lesson_progress", {
    p_student_id: studentId, p_lesson_id: lessonId, p_course_id: courseId, p_complete: complete,
  });
  if (error) throw error;
  const progress = data?.progress;
  if (!progress || typeof progress.id !== "string" || progress.user_id !== studentId || progress.lesson_id !== lessonId ||
      (progress.status_code !== "in_progress" && progress.status_code !== "completed") ||
      typeof progress.progress_percentage !== "number") throw new Error("Invalid lesson progress response.");
  parseProgressSnapshot(data.course_progress);
  return progress;
}
