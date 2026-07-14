import type { QueryClient } from "@tanstack/react-query";

/** Shared policy for data shown in the four long-lived dashboards. */
export const DASHBOARD_STALE_TIME = 60_000;
export const DASHBOARD_GC_TIME = 30 * 60_000;
export const DASHBOARD_REFETCH_INTERVAL = 2 * 60_000;

type ActionResult = { error?: string | null };

/** Server actions return an error object; React Query needs a rejected promise. */
export function unwrapActionResult<T extends ActionResult>(result: T): T {
  if (result.error) throw new Error(result.error);
  return result;
}

type AcademicPrefetch = {
  programs?: Array<{ id: string }>;
  courses?: Array<{ program_id: string }>;
};

/**
 * Populate only keys whose data shape exactly matches the consuming hooks.
 * Course modules deliberately remain in their own deep-query cache: the
 * prefetch payload has no lesson resources and must never masquerade as it.
 */
export function seedAcademicListCaches(queryClient: QueryClient, institutionId: string, data: AcademicPrefetch) {
  queryClient.setQueryData(["programs", institutionId], data.programs ?? []);

  const coursesByProgram = new Map<string, Array<{ program_id: string }>>();
  for (const course of data.courses ?? []) {
    const courses = coursesByProgram.get(course.program_id) ?? [];
    courses.push(course);
    coursesByProgram.set(course.program_id, courses);
  }
  for (const [programId, courses] of coursesByProgram) {
    queryClient.setQueryData(["courses", programId], courses);
  }
}
