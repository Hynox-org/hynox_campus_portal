import { useQuery } from "@tanstack/react-query";
import {
  listAllCohortsAction,
  listTeacherCohortsAction,
  listCohortsAction,
  getStudentDeliveryDataAction
} from "@/app/actions/delivery-actions";
import { listAllTeachersAction } from "@/app/actions/institution-actions";
import { getDeliveryPrefetchDataAction, getLearningPrefetchDataAction } from "@/app/actions/prefetch-actions";
import { DASHBOARD_GC_TIME, DASHBOARD_REFETCH_INTERVAL, DASHBOARD_STALE_TIME, unwrapActionResult } from "@/lib/dashboard-query";

export function useAllTeachers() {
  return useQuery({
    queryKey: ["all-teachers"],
    queryFn: async () => {
      const res = await listAllTeachersAction();
      if (res.error) throw new Error(res.error);
      return res.teachers || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });
}

export function useAllCohorts() {
  return useQuery({
    queryKey: ["all-cohorts"],
    queryFn: async () => {
      const res = await listAllCohortsAction();
      if (res.error) throw new Error(res.error);
      return res.cohorts || [];
    },
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });
}

export function useTeacherCohorts(teacherId: string) {
  return useQuery({
    queryKey: ["teacher-cohorts", teacherId],
    queryFn: async () => {
      if (!teacherId) return [];
      const res = await listTeacherCohortsAction(teacherId, false);
      if (res.error) throw new Error(res.error);
      return res.cohorts || [];
    },
    enabled: !!teacherId,
  });
}

export function useTenantCohorts(tenantId: string) {
  return useQuery({
    queryKey: ["tenant-cohorts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await listCohortsAction(tenantId);
      if (res.error) throw new Error(res.error);
      return res.cohorts || [];
    },
    enabled: !!tenantId,
  });
}

// Aggressive Prefetch Hooks
export function useDeliveryData(institutionId: string | null | undefined) {
  return useQuery({
    queryKey: ["delivery-prefetch", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      return unwrapActionResult(await getDeliveryPrefetchDataAction(institutionId));
    },
    enabled: !!institutionId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
}

export function useLearningData(institutionId: string | null | undefined) {
  return useQuery({
    queryKey: ["learning-prefetch", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      return unwrapActionResult(await getLearningPrefetchDataAction(institutionId));
    },
    enabled: !!institutionId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
}

export function useStudentDeliveryData(userId: string | undefined) {
  return useQuery({
    queryKey: ["student-delivery", userId],
    queryFn: async () => {
      if (!userId) return null;
      return unwrapActionResult(await getStudentDeliveryDataAction(userId));
    },
    enabled: !!userId,
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
}
