import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/endpoints/admin";
import { adminKeys } from "@/features/keys";

/** Platform-wide aggregates + time series for the dashboards. */
export function useOverviewStats(days = 14) {
  return useQuery({
    queryKey: adminKeys.stats(days),
    queryFn: () => adminApi.getStats(days),
    staleTime: 60_000,
  });
}
