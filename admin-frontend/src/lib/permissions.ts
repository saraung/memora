/**
 * Canonical staff permission codes — mirrors the backend
 * (app/modules/authorization/permissions.py). Keep in sync.
 */
export const PERM = {
  REPORTS_READ: "reports:read",
  REPORTS_REVIEW: "reports:review",
  CONTENT_REMOVE: "content:remove",
  USERS_READ: "users:read",
  USERS_SUSPEND: "users:suspend",
  STAFF_MANAGE: "staff:manage",
  ANALYTICS_READ: "analytics:read",
  AUDIT_READ: "audit:read",
  SETTINGS_READ: "settings:read",
} as const;

export type PermissionCode = (typeof PERM)[keyof typeof PERM];
