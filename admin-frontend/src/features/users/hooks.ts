import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminApi } from "@/services/endpoints/admin";
import { adminKeys } from "@/features/keys";
import type { AccountStatusChange } from "@/types/admin";

export function useUserSearch(query: string) {
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: adminKeys.users(trimmed),
    queryFn: ({ pageParam }) =>
      adminApi.searchUsers({ q: trimmed, cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    enabled: trimmed.length >= 1,
  });
}

export function useUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: adminKeys.user(userId ?? ""),
    queryFn: () => adminApi.getUserDetail(userId!),
    enabled: Boolean(userId),
  });
}

export function useSetAccountStatus(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountStatusChange) =>
      adminApi.setAccountStatus(userId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.user(userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

export function useGrantRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: string) => adminApi.grantRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.user(userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}

export function useRevokeRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleName: string) => adminApi.revokeRole(userId, roleName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.user(userId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.staff });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
}
