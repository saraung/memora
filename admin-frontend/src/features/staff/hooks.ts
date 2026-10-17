import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/endpoints/admin";
import { adminKeys } from "@/features/keys";

/** Everyone holding at least one staff role. */
export function useStaff() {
  return useQuery({
    queryKey: adminKeys.staff,
    queryFn: () => adminApi.listStaff(),
    staleTime: 30_000,
  });
}

/** Role catalog with their permission codes. */
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: adminKeys.roles,
    queryFn: () => adminApi.listRoles(),
    staleTime: 5 * 60_000,
    enabled,
  });
}
