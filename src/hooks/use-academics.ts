import type { Module, Lesson } from "@/types/campus";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { 
  listProgramsAction,
  listTenantInstructorsAction,
  listCoursesAction,
  listModulesAction,
  listLessonsAction,
  listLessonResourcesAction,
  getCourseInstructorsAction,
  getAcademicLookupsAction
} from "@/app/actions/academic-actions";
import { getInstitutionPrefetchDataAction } from "@/app/actions/prefetch-actions";
import { DASHBOARD_GC_TIME, DASHBOARD_REFETCH_INTERVAL, DASHBOARD_STALE_TIME, unwrapActionResult } from "@/lib/dashboard-query";

type CourseLesson = Lesson;

type CourseModule = Module;

export function useAcademicLookups() {
  return useQuery({
    queryKey: ["academic-lookups"],
    queryFn: async () => {
      const res = await getAcademicLookupsAction();
      if (res.error) throw new Error(res.error);
      return unwrapActionResult(res).lookups;
    },
    staleTime: Infinity, // Lookups rarely change
  });
}

export function usePrograms(institutionId: string) {
  return useQuery({
    queryKey: ["programs", institutionId],
    queryFn: async () => {
      if (!institutionId) return [];
      const res = await listProgramsAction(institutionId);
      if (res.error) throw new Error(res.error);
      return res.programs || [];
    },
    enabled: !!institutionId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });
}

export function useTenantInstructors(institutionId: string) {
  return useQuery({
    queryKey: ["tenant-instructors", institutionId],
    queryFn: async () => {
      if (!institutionId) return [];
      const res = await listTenantInstructorsAction(institutionId);
      if (res.error) throw new Error(res.error);
      return res.instructors || [];
    },
    enabled: !!institutionId,
  });
}

export function useCourses(programId: string) {
  return useQuery({
    queryKey: ["courses", programId],
    queryFn: async () => {
      if (!programId) return [];
      const res = await listCoursesAction(programId);
      if (res.error) throw new Error(res.error);
      return res.courses || [];
    },
    enabled: !!programId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });
}

// Full module with lessons and resources fetching
export function useCourseModules(courseId: string) {
  return useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const mRes = await listModulesAction(courseId);
      if (mRes.error) throw new Error(mRes.error);
      
      if (!mRes.modules) return [];

      const modulesWithLessons = await Promise.all(
        mRes.modules.map(async (m: CourseModule) => {
          const lRes = await listLessonsAction(m.id);
          const lessons = lRes.lessons || [];
          const lessonsWithResources = await Promise.all(
          lessons.map(async (l: CourseLesson) => {
              const rRes = await listLessonResourcesAction(l.id);
              return { ...l, resources: rRes.resources || [] };
            })
          );
          return { ...m, lessons: lessonsWithResources };
        })
      );
      
      return modulesWithLessons;
    },
    enabled: !!courseId,
  });
}

export function useCourseInstructors(courseId: string) {
  return useQuery({
    queryKey: ["course-instructors", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const res = await getCourseInstructorsAction(courseId);
      if (res.error) throw new Error(res.error);
      return res.instructors || [];
    },
    enabled: !!courseId,
  });
}

/**
 * Lazy per-node keys for the program manager's live curriculum tree (as opposed to
 * useCourseModules, which eagerly fetches the whole modules/lessons/resources tree
 * for a course in one shot). Kept as distinct query keys so the two consumers never
 * read a differently-shaped cache entry under the same key.
 */
export const liveCurriculumKeys = {
  modules: (courseId: string) => ["academic-modules", courseId] as const,
  lessons: (moduleId: string) => ["academic-lessons", moduleId] as const,
  resources: (lessonId: string) => ["academic-resources", lessonId] as const,
};

export function fetchModules(queryClient: QueryClient, courseId: string) {
  return queryClient.fetchQuery({
    queryKey: liveCurriculumKeys.modules(courseId),
    queryFn: async () => {
      const res = await listModulesAction(courseId);
      if (res.error) throw new Error(res.error);
      return res.modules || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function fetchLessons(queryClient: QueryClient, moduleId: string) {
  return queryClient.fetchQuery({
    queryKey: liveCurriculumKeys.lessons(moduleId),
    queryFn: async () => {
      const res = await listLessonsAction(moduleId);
      if (res.error) throw new Error(res.error);
      return res.lessons || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function fetchResources(queryClient: QueryClient, lessonId: string) {
  return queryClient.fetchQuery({
    queryKey: liveCurriculumKeys.resources(lessonId),
    queryFn: async () => {
      const res = await listLessonResourcesAction(lessonId);
      if (res.error) throw new Error(res.error);
      return res.resources || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

export function useAcademicPrefetchData(institutionId: string | undefined | null) {
  return useQuery({
    queryKey: ["academic-prefetch", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      return unwrapActionResult(await getInstitutionPrefetchDataAction(institutionId));
    },
    enabled: !!institutionId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
}
