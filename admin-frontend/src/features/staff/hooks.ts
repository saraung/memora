import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/endpoints/admin";
import { adminKeys } from "@/features/keys";
import type { RoleInput } from "@/types/admin";

/** Role catalog with their permission codes and member counts. */
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: adminKeys.roles,
    queryFn: () => adminApi.listRoles(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Every permission code staff can be granted. */
export function usePermissions(enabled = true) {
  return useQuery({
    queryKey: adminKeys.permissions,
    queryFn: () => adminApi.listPermissions(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Everyone holding at least one staff role. */
export function useStaff() {
  return useQuery({
    queryKey: adminKeys.staff,
    queryFn: () => adminApi.listStaff(),
    staleTime: 30_000,
  });
}

function useInvalidateRoleData() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.roles });
    void queryClient.invalidateQueries({ queryKey: adminKeys.staff });
    void queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateRoleData();
  return useMutation({
    mutationFn: (payload: RoleInput) => adminApi.createRole(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateRole(name: string) {
  const invalidate = useInvalidateRoleData();
  return useMutation({
    mutationFn: (payload: RoleInput) => adminApi.updateRole(name, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoleData();
  return useMutation({
    mutationFn: (name: string) => adminApi.deleteRole(name),
    onSuccess: invalidate,
  });
}
