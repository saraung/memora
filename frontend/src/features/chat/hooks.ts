import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, tokenStore } from "@/services/api-client";
import {
  contentApi,
  uploadToProvider,
  type UploadIntent,
} from "@/services/endpoints/content";
import { messagingApi } from "@/services/endpoints/messaging";
import { realtime, type ServerMessage } from "@/services/realtime";
import type { ConversationPreview, MessageItem } from "@/types/chat";

export const chatKeys = {
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["messages", id] as const,
};

function toastError(
  toast: (msg: string, kind?: "error") => void,
  error: unknown,
  fallback: string,
) {
  toast(
    error instanceof ApiError ? error.message : fallback,
    "error",
  );
}

/* ------------------------------ conversations ------------------------------ */

export function useConversations() {
  return useInfiniteQuery({
    queryKey: chatKeys.conversations,
    queryFn: ({ pageParam }) => messagingApi.conversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useStartDirectMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({
      participantId,
      body,
      mediaIds = [],
    }: {
      participantId: string;
      body: string;
      mediaIds?: string[];
    }) => messagingApi.startDirect(participantId, body, mediaIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      queryClient.setQueryData(
        chatKeys.conversation(result.conversation.id),
        result.conversation,
      );
    },
    onError: (error) =>
      toastError(toast, error, "Could not send the message. Please try again."),
  });
}

/* -------------------------------- messages --------------------------------- */

export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId ?? ""),
    queryFn: ({ pageParam }) =>
      messagingApi.messages(conversationId ?? "", pageParam),
    enabled: Boolean(conversationId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ body, mediaIds = [] }: { body: string; mediaIds?: string[] }) =>
      messagingApi.sendMessage(conversationId, body, mediaIds),
    onSuccess: (item) => {
      queryClient.setQueriesData<{ pages: { items: MessageItem[] }[] }>(
        { queryKey: chatKeys.messages(conversationId) },
        (old) => {
          if (!old?.pages?.length) return old;
          const [first, ...rest] = old.pages;
          if (!first) return old;
          // Dedup: the WS broadcast arrives before the HTTP response, so the
          // message may already be in the cache via useRealtime.
          if (first.items.some((m) => m.message.id === item.message.id)) {
            return old;
          }
          return {
            ...old,
            pages: [{ ...first, items: [item, ...first.items] }, ...rest],
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (error) =>
      toastError(toast, error, "Could not send the message. Please try again."),
  });
}

export function useMarkRead(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (upToMessageId?: string) => {
      if (!conversationId) throw new Error("No conversation selected");
      return messagingApi.markRead(conversationId, upToMessageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      messagingApi.editMessage(id, body),
    onSuccess: (item) => {
      const key = chatKeys.messages(item.message.conversation_id);
      queryClient.setQueriesData<{ pages: { items: MessageItem[] }[] }>(
        { queryKey: key },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((m) => (m.message.id === item.message.id ? item : m)),
            })),
          };
        },
      );
    },
    onError: (error) =>
      toastError(toast, error, "Could not edit the message. Please try again."),
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => messagingApi.deleteMessage(messageId).then(() => conversationId),
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(conversationId),
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the message. Please try again."),
  });
}

/* -------------------------------- realtime ---------------------------------- */

/**
 * Runs the shared socket while authenticated. Incoming messages update
 * the open conversation live; anything else bumps previews + toasts and
 * refreshes notification state. Pass the open conversation id so it can
 * be marked read instead of toasted.
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (conversationId: string) =>
      messagingApi.deleteConversation(conversationId),
    onSuccess: (_v, conversationId) => {
      toast("Conversation deleted.", "success");
      queryClient.removeQueries({
        queryKey: chatKeys.messages(conversationId),
      });
      queryClient.removeQueries({
        queryKey: chatKeys.conversation(conversationId),
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the conversation. Please try again."),
  });
}

export interface PendingAttachment {
  file: File;
  preview: string;
}

/** Image attachments for the message composer (max 5, images only). */
export function useAttachments() {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const add = (incoming: FileList | null) => {
    if (!incoming) return null as string | null;
    for (const file of Array.from(incoming)) {
      if (!file.type.startsWith("image/")) {
        return "Only images can be attached for now.";
      }
      if (items.length >= 5) return "At most 5 images per message.";
    }
    setItems((prev) =>
      [...prev, ...Array.from(incoming!)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 5 - prev.length)
        .map((file) => ({ file, preview: URL.createObjectURL(file) }))],
    );
    return null;
  };

  const remove = (preview: string) =>
    setItems((prev) => {
      const target = prev.find((p) => p.preview === preview);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.preview !== preview);
    });

  const clear = () =>
    setItems((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });

  /** Upload all pending files via the media intent flow. Returns asset ids. */
  const uploadAll = async (): Promise<string[]> => {
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const item of items) {
        const intent: UploadIntent = await contentApi.createUploadIntent(
          item.file.type,
          item.file.size,
        );
        await uploadToProvider(intent, item.file);
        ids.push((await contentApi.completeUpload(intent.id)).id);
      }
      return ids;
    } finally {
      setUploading(false);
    }
  };

  return { items, add, remove, clear, uploading, uploadAll };
}

export function useRealtime(activeConversationId?: string) {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (status !== "authenticated" || !tokenStore.get()) return;
    realtime.start();
    const off = realtime.onMessage((msg: ServerMessage) => {
      if (msg.type !== "message") return;
      const incoming = msg.message;
      const conversationId = msg.conversation_id;
      if (!incoming || !conversationId) return;
      if (conversationId === activeConversationId) {
        // Live append + mark read; no toast for the open thread.
        queryClient.setQueriesData<{ pages: { items: MessageItem[] }[] }>(
          { queryKey: chatKeys.messages(conversationId) },
          (old) => {
            if (!old?.pages?.length) return old;
            const [first, ...rest] = old.pages;
            if (first.items.some((m) => m.message.id === incoming.id)) {
              return old;
            }
            return {
              ...old,
              pages: [
                {
                  ...first,
                  items: [
                    {
                      message: {
                        id: incoming.id,
                        conversation_id: incoming.conversation_id,
                        sender_id: incoming.sender_id,
                        body: incoming.body,
                        is_edited: incoming.is_edited,
                        is_deleted: incoming.is_deleted,
                        created_at: incoming.created_at,
                      },
                    sender: {
                      id: incoming.sender_id,
                      username: "",
                      display_name: "",
                      avatar_url: null,
                      is_verified: false,
                    },
                    read_count: 0,
                    media: (msg.media ?? []).map((m) => ({
                      id: m.id,
                      resource_type: m.resource_type,
                      width: m.width,
                      height: m.height,
                      secure_url: m.secure_url,
                    })),
                    },
                    ...first.items,
                  ],
                },
                ...rest,
              ],
            };
          },
        );
        messagingApi
          .markRead(conversationId, incoming.id)
          .then(() =>
            queryClient.invalidateQueries({
              queryKey: chatKeys.conversations,
            }),
          )
          .catch(() => undefined);
      } else {
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
        toast("New message — open Messages to read it.", "info");
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    });
    if (activeConversationId) realtime.subscribe(activeConversationId);
    return () => {
      off();
      if (activeConversationId) realtime.unsubscribe(activeConversationId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activeConversationId]);
}

/** Keep the socket alive app-wide (subscribed only when a thread opens). */
export function useRealtimeConnection() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "authenticated" || !tokenStore.get()) return;
    realtime.start();
    return () => {
      realtime.stop();
    };
  }, [status]);
}

export type { ConversationPreview };
