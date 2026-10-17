import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/services/api-client";
import { notificationsApi } from "@/services/endpoints/notifications";

export const notificationKeys = {
  list: ["notifications"] as const,
  unread: ["notifications-unread"] as const,
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

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
    staleTime: 15_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsApi.unreadCount,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    },
    onError: (error) =>
      toastError(toast, error, "Could not update the notification. Please try again."),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (marked) => {
      toast(
        marked > 0 ? `Marked ${marked} as read.` : "Already all caught up.",
        "success",
      );
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    },
    onError: (error) =>
      toastError(toast, error, "Could not update notifications. Please try again."),
  });
}
