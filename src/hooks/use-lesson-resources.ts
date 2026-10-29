"use client";

import { useQuery } from "@tanstack/react-query";
import { listLessonResourcesAction } from "@/app/actions/academic-actions";
import { DASHBOARD_GC_TIME, DASHBOARD_STALE_TIME } from "@/lib/dashboard-query";

/** A lesson's resources are not part of the lightweight academic prefetch. */
export function useLessonResources(lessonId?: string) {
  return useQuery({
    queryKey: ["academic-resources", lessonId],
    enabled: !!lessonId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    queryFn: async () => {
      if (!lessonId) return [];
      const result = await listLessonResourcesAction(lessonId);
      if (result.error) throw new Error(result.error);
      return result.resources || [];
    },
  });
}
