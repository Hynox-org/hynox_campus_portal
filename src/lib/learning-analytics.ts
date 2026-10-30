import type { Activity, Enrollment, ProjectSubmission, QuizAttempt } from "@/types/campus";
import { isPassedQuizAttempt } from "./quiz-result";

/** Outcomes count assigned Student/activity pairs rather than historical retries. */
export function learningAnalyticsScope(enrollments: Enrollment[], activities: Activity[], attempts: QuizAttempt[], submissions: ProjectSubmission[], cohort = "all") {
  const active = enrollments.filter(e => !e.deleted_at && (!e.status_code || e.status_code === "active") && (cohort === "all" || e.cohort_id === cohort));
  const memberships = new Map<string, Set<string>>();
  for (const e of active) {
    if (!memberships.has(e.user_id)) memberships.set(e.user_id, new Set());
    memberships.get(e.user_id)!.add(e.cohort_id);
  }
  const eligible = new Map<string, Activity>();
  for (const activity of activities) {
    if (activity.deleted_at || activity.status_code !== "published") continue;
    const cohorts = new Set(activity.cohort_ids ?? []);
    for (const [student, groups] of memberships) {
      if ([...groups].some(group => cohorts.has(group))) eligible.set(`${student}:${activity.id}`, activity);
    }
  }
  const allowed = (row: { student_id: string; activity_id?: string; cohort_id?: string }) => !!row.activity_id &&
    eligible.has(`${row.student_id}:${row.activity_id}`) && !!row.cohort_id && memberships.get(row.student_id)?.has(row.cohort_id) &&
    eligible.get(`${row.student_id}:${row.activity_id}`)?.cohort_ids?.includes(row.cohort_id);
  const relevantAttempts = attempts.filter(allowed);
  const latest = new Map<string, QuizAttempt>();
  for (const row of relevantAttempts) {
    const key = `${row.student_id}:${row.activity_id}`;
    const previous = latest.get(key);
    if (!previous || (!isPassedQuizAttempt(previous) && (isPassedQuizAttempt(row) || row.attempt_number > previous.attempt_number))) latest.set(key, row);
  }
  return {
    enrollments: active,
    eligibleQuizCount: [...eligible.values()].filter(a => a.activity_type_code === "quiz").length,
    eligibleProjectCount: [...eligible.values()].filter(a => a.activity_type_code === "project").length,
    attempts: relevantAttempts,
    outcomes: [...latest.values()],
    submissions: submissions.filter(allowed),
  };
}
