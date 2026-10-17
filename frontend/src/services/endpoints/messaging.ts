import { api } from "@/services/api-client";
import type {
  ConversationPage,
  ConversationPreview,
  MessageItem,
  MessagePage,
} from "@/types/chat";

export const messagingApi = {
  async conversations(cursor?: string): Promise<ConversationPage> {
    const { data } = await api.get<ConversationPage>("/conversations", {
      params: { limit: 20, cursor },
    });
    return data;
  },

  async startDirect(
    participantId: string,
    body: string,
    mediaIds: string[] = [],
  ): Promise<{ conversation: ConversationPreview; message: MessageItem }> {
    const { data } = await api.post<{
      conversation: ConversationPreview;
      message: MessageItem;
    }>(
      "/conversations/direct",
      { participant_id: participantId, body, media_ids: mediaIds },
    );
    return data;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/conversations/${conversationId}`);
  },

  async messages(
    conversationId: string,
    cursor?: string,
  ): Promise<MessagePage> {
    const { data } = await api.get<MessagePage>(
      `/conversations/${conversationId}/messages`,
      { params: { limit: 30, cursor } },
    );
    return data;
  },

  async sendMessage(
    conversationId: string,
    body: string,
    mediaIds: string[] = [],
  ): Promise<MessageItem> {
    const { data } = await api.post<MessageItem>(
      `/conversations/${conversationId}/messages`,
      { body, media_ids: mediaIds },
    );
    return data;
  },

  async markRead(
    conversationId: string,
    upToMessageId?: string,
  ): Promise<{ marked: number }> {
    const { data } = await api.post<{ marked: number }>(
      `/conversations/${conversationId}/read`,
      { up_to_message_id: upToMessageId ?? null },
    );
    return data;
  },

  async editMessage(messageId: string, body: string): Promise<MessageItem> {
    const { data } = await api.patch<MessageItem>(`/messages/${messageId}`, {
      body,
    });
    return data;
  },

  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/messages/${messageId}`);
  },

  // -- Calls --------------------------------------------------------------------

  async initiateCall(conversationId: string): Promise<{ call_id: string }> {
    const { data } = await api.post<{ call_id: string }>(
      `/conversations/${conversationId}/call`
    );
    return data;
  },

  async answerCall(callId: string): Promise<{ call_id: string }> {
    const { data } = await api.post<{ call_id: string }>(
      `/calls/${callId}/answer`
    );
    return data;
  },

  async declineCall(callId: string): Promise<{ call_id: string }> {
    const { data } = await api.post<{ call_id: string }>(
      `/calls/${callId}/decline`
    );
    return data;
  },

  async endCall(callId: string, durationSeconds: number): Promise<{ call_id: string }> {
    const { data } = await api.post<{ call_id: string }>(
      `/calls/${callId}/end`,
      { duration_seconds: durationSeconds }
    );
    return data;
  },

  async listCalls(
    conversationId: string,
    limit: number = 20,
    before?: string,
  ): Promise<{ call_id: string; status?: string; created_at?: string }[]> {
    const { data } = await api.get<{ call_id: string; status?: string; created_at?: string }[]>(
      `/conversations/${conversationId}/calls`,
      { params: { limit, before } },
    );
    return data;
  },
};
