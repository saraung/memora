/** Centralized TanStack Query keys for staff data. */

export const adminKeys = {
  stats: (days: number) => ["admin", "stats", days] as const,
  users: (q: string) => ["admin", "users", "search", q] as const,
  user: (id: string) => ["admin", "users", "detail", id] as const,
  staff: ["admin", "staff"] as const,
  roles: ["admin", "roles"] as const,
  permissions: ["admin", "permissions"] as const,
  audit: (filters: { action: string; targetType: string; actorId: string }) =>
    ["admin", "audit", filters] as const,
};
