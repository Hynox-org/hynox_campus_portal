import { expect, it } from "vitest";
import type { Activity, QuizAttempt } from "@/types/campus";
import { learningAnalyticsScope } from "./learning-analytics";
const activity: Activity = { id: "quiz", tenant_id: "campus", institution_id: "campus", lesson_id: "l", activity_type_code: "quiz", status_code: "published", title: "Quiz", description: null, instructions: null, max_score: 100, passing_score: 60, position: 1, is_mandatory: true, available_from: null, available_until: null, created_by: null, created_at: "2026-10-30", updated_at: "2026-10-30", deleted_at: null, cohort_ids: ["a"] };
const attempt: QuizAttempt = { id: "t1", quiz_id: "q", activity_id: "quiz", cohort_id: "a", student_id: "s", student_activity_progress_id: "p", attempt_number: 1, started_at: "2026-10-30", submitted_at: "2026-10-30", score: 0, max_score: 8, passed: false, time_spent_seconds: 1, created_at: "2026-10-30", forfeited: false, forfeit_reason: null, violation_count: 0 };
const enrollments = [{ id: "e1", user_id: "s", cohort_id: "a" }, { id: "e2", user_id: "s", cohort_id: "b" }];
it("counts a failed attempt and passed retake as one assigned outcome", () => {
  const scope = learningAnalyticsScope(enrollments, [activity], [attempt, { ...attempt, id: "t2", attempt_number: 2, passed: true, score: 8 }], []);
  expect(scope.eligibleQuizCount).toBe(1);
  expect(scope.outcomes).toHaveLength(1);
  expect(scope.outcomes[0]).toMatchObject({ id: "t2", passed: true, score: 8, max_score: 8 });
  expect(scope.attempts).toHaveLength(2);
});
it("does not leak another cohort's attempts for a Student shared by both cohorts", () => {
  const scope = learningAnalyticsScope(enrollments, [activity], [attempt], [], "b");
  expect(scope.eligibleQuizCount).toBe(0);
  expect(scope.attempts).toHaveLength(0);
});
it("ignores draft activities and ended enrollments when building eligible slots", () => {
  const scope = learningAnalyticsScope([{ ...enrollments[0], status_code: "inactive" }], [activity, { ...activity, id: "draft", status_code: "draft" }], [attempt], []);
  expect(scope.eligibleQuizCount).toBe(0); expect(scope.outcomes).toHaveLength(0);
});
it("keeps an in-progress session distinct from a failed result", () => {
  const scope = learningAnalyticsScope(enrollments, [activity], [{ ...attempt, submitted_at: null, passed: null, score: null }], []);
  expect(scope.outcomes[0].submitted_at).toBeNull();
});
