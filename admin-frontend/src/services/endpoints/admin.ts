import { api } from "@/services/api-client";
import type { Paginated } from "@/types/api";
import type {
  AccountStatusChange,
  AdminUser,
  AdminUserDetail,
  AuditEvent,
  Permission,
  Role,
  RoleInput,
  StaffMember,
} from "@/types/admin";
import type { OverviewStats } from "@/types/analytics";
import type {
  ModerationDecision,
  Report,
  ReportCategory,
  ReportDetail,
  ReportStatus,
} from "@/types/moderation";

export interface ReportQuery {
  status?: ReportStatus | "";
  category?: ReportCategory | "";
  limit?: number;
  cursor?: string | null;
}

export const adminApi = {
  async getStats(days = 14): Promise<OverviewStats> {
    const { data } = await api.get<OverviewStats>("/admin/stats", {
      params: { days },
    });
    return data;
  },

  async listReports(query: ReportQuery = {}): Promise<Paginated<Report>> {
    const { data } = await api.get<Paginated<Report>>("/admin/reports", {
      params: {
        status: query.status || undefined,
        category: query.category || undefined,
        limit: query.limit,
        cursor: query.cursor ?? undefined,
      },
    });
    return data;
  },

  async getReport(reportId: string): Promise<ReportDetail> {
    const { data } = await api.get<ReportDetail>(`/admin/reports/${reportId}`);
    return data;
  },

  async decideReport(
    reportId: string,
    payload: { decision: ModerationDecision; reason: string },
  ): Promise<Report> {
    const { data } = await api.post<Report>(
      `/admin/reports/${reportId}/actions`,
      payload,
    );
    return data;
  },

  async listAuditEvents(
    params: {
      limit?: number;
      cursor?: string | null;
      action?: string;
      targetType?: string;
      actorId?: string;
    } = {},
  ): Promise<Paginated<AuditEvent>> {
    const { data } = await api.get<Paginated<AuditEvent>>(
      "/admin/audit-events",
      {
        params: {
          limit: params.limit,
          cursor: params.cursor ?? undefined,
          action: params.action || undefined,
          target_type: params.targetType || undefined,
          actor_id: params.actorId || undefined,
        },
      },
    );
    return data;
  },

  async searchUsers(params: {
    q: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<Paginated<AdminUser>> {
    const { data } = await api.get<Paginated<AdminUser>>("/admin/users", {
      params: { q: params.q, limit: params.limit, cursor: params.cursor ?? undefined },
    });
    return data;
  },

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const { data } = await api.get<AdminUserDetail>(`/admin/users/${userId}`);
    return data;
  },

  async listStaff(): Promise<StaffMember[]> {
    const { data } = await api.get<StaffMember[]>("/admin/staff");
    return data;
  },

  async setAccountStatus(
    userId: string,
    payload: AccountStatusChange,
  ): Promise<AdminUser> {
    const { data } = await api.patch<AdminUser>(
      `/admin/users/${userId}/status`,
      payload,
    );
    return data;
  },

  async listRoles(): Promise<Role[]> {
    const { data } = await api.get<Role[]>("/admin/roles");
    return data;
  },

  async listPermissions(): Promise<Permission[]> {
    const { data } = await api.get<Permission[]>("/admin/permissions");
    return data;
  },

  async createRole(payload: RoleInput): Promise<Role> {
    const { data } = await api.post<Role>("/admin/roles", payload);
    return data;
  },

  async updateRole(name: string, payload: RoleInput): Promise<Role> {
    const { data } = await api.patch<Role>(`/admin/roles/${name}`, payload);
    return data;
  },

  async deleteRole(name: string): Promise<void> {
    await api.delete(`/admin/roles/${name}`);
  },

  async grantRole(userId: string, role: string): Promise<AdminUser> {
    const { data } = await api.post<AdminUser>(`/admin/users/${userId}/roles`, {
      role,
    });
    return data;
  },

  async revokeRole(userId: string, roleName: string): Promise<AdminUser> {
    const { data } = await api.delete<AdminUser>(
      `/admin/users/${userId}/roles/${roleName}`,
    );
    return data;
  },
};
