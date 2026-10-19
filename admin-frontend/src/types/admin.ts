/** Staff administration domain types. */

import type { AccountStatus } from "@/types/auth";

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  account_status: AccountStatus;
  is_verified: boolean;
  is_private: boolean;
  roles: string[];
  created_at: string;
}

export interface UserReportRef {
  id: string;
  category: string;
  status: string;
  created_at: string;
}

export interface AdminUserDetail extends AdminUser {
  followers: number;
  following: number;
  posts: number;
  recent_reports: UserReportRef[];
}

export interface StaffMember {
  id: string;
  email: string;
  username: string;
  display_name: string;
  account_status: AccountStatus;
  roles: string[];
  created_at: string;
}

export interface Role {
  name: string;
  description: string;
  permissions: string[];
  holders: number;
}

export interface Permission {
  code: string;
  description: string;
}

export interface RoleInput {
  name?: string;
  description: string;
  permissions: string[];
}

export interface RoleAssignment {
  role: string;
}

export interface AccountStatusChange {
  status: AccountStatus;
  reason: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  request_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}
