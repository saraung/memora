import { api } from "@/services/api-client";
import type {
  BlockStatus,
  FollowRequestItem,
  FollowStatus,
  Profile,
  UpdateProfilePayload,
  UserPage,
  UserSummary,
} from "@/types/social";

export const socialApi = {
  async getProfile(username: string): Promise<Profile> {
    const { data } = await api.get<Profile>(
      `/users/${encodeURIComponent(username)}`,
    );
    return data;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<Profile> {
    const { data } = await api.patch<Profile>("/users/me", payload);
    return data;
  },

  async setPrivacy(is_private: boolean): Promise<Profile> {
    const { data } = await api.patch<Profile>("/users/me/privacy", {
      is_private,
    });
    return data;
  },

  async follow(userId: string): Promise<FollowStatus> {
    const { data } = await api.post<{ status: FollowStatus }>(
      `/users/${userId}/follow`,
    );
    return data.status;
  },

  async unfollow(userId: string): Promise<FollowStatus> {
    const { data } = await api.delete<{ status: FollowStatus }>(
      `/users/${userId}/follow`,
    );
    return data.status;
  },

  async followers(
    username: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<UserPage> {
    const { data } = await api.get<UserPage>(
      `/users/${encodeURIComponent(username)}/followers`,
      { params },
    );
    return data;
  },

  async following(
    username: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<UserPage> {
    const { data } = await api.get<UserPage>(
      `/users/${encodeURIComponent(username)}/following`,
      { params },
    );
    return data;
  },

  async blocked(): Promise<UserSummary[]> {
    const { data } = await api.get<UserSummary[]>("/users/me/blocked");
    return data;
  },

  async block(userId: string): Promise<BlockStatus> {
    const { data } = await api.post<{ status: BlockStatus }>(
      `/users/${userId}/block`,
    );
    return data.status;
  },

  async unblock(userId: string): Promise<BlockStatus> {
    const { data } = await api.delete<{ status: BlockStatus }>(
      `/users/${userId}/block`,
    );
    return data.status;
  },

  async followRequests(): Promise<FollowRequestItem[]> {
    const { data } = await api.get<FollowRequestItem[]>("/follow-requests");
    return data;
  },

  async approveRequest(requestId: string): Promise<FollowRequestItem> {
    const { data } = await api.post<FollowRequestItem>(
      `/follow-requests/${requestId}/approve`,
    );
    return data;
  },

  async rejectRequest(requestId: string): Promise<FollowRequestItem> {
    const { data } = await api.post<FollowRequestItem>(
      `/follow-requests/${requestId}/reject`,
    );
    return data;
  },

  async cancelRequest(requestId: string): Promise<FollowRequestItem> {
    const { data } = await api.delete<FollowRequestItem>(
      `/follow-requests/${requestId}`,
    );
    return data;
  },
};
