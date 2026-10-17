import { useInfiniteQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/endpoints/admin";
import { adminKeys } from "@/features/keys";

export interface AuditFilters {
  action: string;
  targetType: string;
  actorId: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  action: "",
  targetType: "",
  actorId: "",
};

export function useAuditEvents(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: adminKeys.audit(filters),
    queryFn: ({ pageParam }) =>
      adminApi.listAuditEvents({
        ...filters,
        cursor: pageParam,
        limit: 25,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
  });
}
