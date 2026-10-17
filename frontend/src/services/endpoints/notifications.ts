import { api } from "@/services/api-client";
import type { NotificationPage } from "@/types/chat";

export const notificationsApi = {
  async list(cursor?: string): Promise<NotificationPage> {
    const { data } = await api.get<NotificationPage>("/notifications", {
      params: { limit: 20, cursor },
    });
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get<{ unread_count: number }>(
      "/notifications/unread-count",
    );
    return data.unread_count;
  },

  async markRead(notificationId: string): Promise<void> {
    await api.post(`/notifications/${notificationId}/read`);
  },

  async markAllRead(): Promise<number> {
    const { data } = await api.post<{ marked: number }>(
      "/notifications/read-all",
    );
    return data.marked;
  },
};
