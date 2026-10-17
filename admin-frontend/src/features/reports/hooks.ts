import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminApi, type ReportQuery } from "@/services/endpoints/admin";
import type { ModerationDecision, ReportCategory, ReportStatus } from "@/types/moderation";

export interface ReportFilters {
  status: ReportStatus | "";
  category: ReportCategory | "";
}

export const reportKeys = {
  all: ["reports"] as const,
  list: (filters: ReportFilters) => ["reports", "list", filters] as const,
  detail: (id: string) => ["reports", "detail", id] as const,
  audit: ["audit-events"] as const,
};

export function useReports(filters: ReportFilters) {
  return useInfiniteQuery({
    queryKey: reportKeys.list(filters),
    queryFn: ({ pageParam }) =>
      adminApi.listReports({ ...filters, cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.has_more ? last.next_cursor : undefined,
  });
}

export function useReport(reportId: string | undefined) {
  return useQuery({
    queryKey: reportKeys.detail(reportId ?? ""),
    queryFn: () => adminApi.getReport(reportId!),
    enabled: Boolean(reportId),
  });
}

export function useDecideReport(reportId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { decision: ModerationDecision; reason: string }) =>
      adminApi.decideReport(reportId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.all });
      void queryClient.invalidateQueries({ queryKey: reportKeys.audit });
    },
  });
}

/** Pending-report count (capped display) + recent moderation activity. */
export function useOverview() {
  const pending = useInfiniteQuery({
    queryKey: reportKeys.list({ status: "pending", category: "" }),
    queryFn: () =>
      adminApi.listReports({ status: "pending", limit: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: () => undefined,
  });

  const activity = useQuery({
    queryKey: reportKeys.audit,
    queryFn: () => adminApi.listAuditEvents({ limit: 8 }),
  });

  const pendingCount = pending.data?.pages[0]?.items.length ?? 0;
  const pendingCapped = pending.data?.pages[0]?.has_more ?? false;

  return { pending, activity, pendingCount, pendingCapped };
}

export type { ReportQuery };
