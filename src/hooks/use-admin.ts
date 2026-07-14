import { useQuery } from "@tanstack/react-query";
import { getAdminPrefetchDataAction } from "@/app/actions/prefetch-actions";
import { DASHBOARD_GC_TIME, DASHBOARD_REFETCH_INTERVAL, DASHBOARD_STALE_TIME, unwrapActionResult } from "@/lib/dashboard-query";

export function useAdminData() {
  return useQuery({
    queryKey: ["admin-prefetch"],
    queryFn: async () => {
      return unwrapActionResult(await getAdminPrefetchDataAction());
    },
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });
}
