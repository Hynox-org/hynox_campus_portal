import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  listCourseTemplatesAction,
  listModuleTemplatesAction,
  listLessonTemplatesAction,
  listResourceTemplatesAction,
} from "@/app/actions/library-actions";
import { DASHBOARD_GC_TIME, DASHBOARD_STALE_TIME } from "@/lib/dashboard-query";

export const libraryKeys = {
  courseTemplates: ["course-templates"] as const,
  moduleTemplates: (courseId: string) => ["module-templates", courseId] as const,
  lessonTemplates: (moduleId: string) => ["lesson-templates", moduleId] as const,
  resourceTemplates: (lessonId: string) => ["resource-templates", lessonId] as const,
};

/** Top-level course blueprint list, shared by the library builder and the program manager's clone picker. */
export function useCourseTemplates() {
  return useQuery({
    queryKey: libraryKeys.courseTemplates,
    queryFn: async () => {
      const res = await listCourseTemplatesAction();
      if (res.error) throw new Error(res.error);
      return res.templates || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });
}

export function fetchModuleTemplates(queryClient: QueryClient, courseId: string) {
  return queryClient.fetchQuery({
    queryKey: libraryKeys.moduleTemplates(courseId),
    queryFn: async () => {
      const res = await listModuleTemplatesAction(courseId);
      if (res.error) throw new Error(res.error);
      return res.modules || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function fetchLessonTemplates(queryClient: QueryClient, moduleId: string) {
  return queryClient.fetchQuery({
    queryKey: libraryKeys.lessonTemplates(moduleId),
    queryFn: async () => {
      const res = await listLessonTemplatesAction(moduleId);
      if (res.error) throw new Error(res.error);
      return res.lessons || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function fetchResourceTemplates(queryClient: QueryClient, lessonId: string) {
  return queryClient.fetchQuery({
    queryKey: libraryKeys.resourceTemplates(lessonId),
    queryFn: async () => {
      const res = await listResourceTemplatesAction(lessonId);
      if (res.error) throw new Error(res.error);
      return res.resources || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}
