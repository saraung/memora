import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { contentKeys } from "@/features/content/hooks";
import { socialKeys } from "@/features/social/hooks";
import { ApiError } from "@/services/api-client";
import {
  contentApi,
  uploadToProvider,
  type UploadIntent,
} from "@/services/endpoints/content";
import { ephemeralApi } from "@/services/endpoints/ephemeral";
import type { Reel } from "@/types/ephemeral";

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

export const ephemeralKeys = {
  storyFeed: ["story-feed"] as const,
  story: (id: string) => ["story", id] as const,
  storyViewers: (id: string) => ["story-viewers", id] as const,
  reelFeed: ["reel-feed"] as const,
  reel: (id: string) => ["reel", id] as const,
  reelComments: (id: string) => ["reel-comments", id] as const,
  savedReels: ["saved-reels"] as const,
  userReels: (username: string) =>
    ["user-reels", username.toLowerCase()] as const,
};

/* -------------------------------- stories ------------------------------- */

export function useStoryFeed() {
  return useInfiniteQuery({
    queryKey: ephemeralKeys.storyFeed,
    queryFn: ({ pageParam }) => ephemeralApi.storyFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useStory(storyId: string | undefined) {
  return useQuery({
    queryKey: ephemeralKeys.story(storyId ?? ""),
    queryFn: () => ephemeralApi.getStory(storyId ?? ""),
    enabled: Boolean(storyId),
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}

export function useUserStories(username: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["user-stories", username?.toLowerCase() ?? ""],
    queryFn: ({ pageParam }) =>
      ephemeralApi.userStories(username ?? "", pageParam),
    enabled: Boolean(username),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function usePublishStory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      file: File;
      caption: string | null;
      onProgress?: (stage: string) => void;
    }): Promise<string> => {
      input.onProgress?.("Uploading…");
      const intent: UploadIntent = await contentApi.createUploadIntent(
        input.file.type,
        input.file.size,
      );
      await uploadToProvider(intent, input.file);
      input.onProgress?.("Publishing…");
      const asset = await contentApi.completeUpload(intent.id);
      const story = await ephemeralApi.publishStory(asset.id, input.caption);
      return story.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ephemeralKeys.storyFeed });
    },
    onError: (error) =>
      toastError(toast, error, "Could not publish your story. Please try again."),
  });
}

export function useViewStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => ephemeralApi.viewStory(storyId),
    onSuccess: (story) => {
      queryClient.setQueryData(
        ephemeralKeys.story(story.id),
        story,
      );
      queryClient.invalidateQueries({ queryKey: ephemeralKeys.storyFeed });
      queryClient.invalidateQueries({
        queryKey: ephemeralKeys.storyViewers(story.id),
      });
    },
  });
}

export function useStoryViewers(storyId: string | undefined) {
  return useQuery({
    queryKey: ephemeralKeys.storyViewers(storyId ?? ""),
    queryFn: () => ephemeralApi.storyViewers(storyId ?? ""),
    enabled: Boolean(storyId),
    retry: (count, error) =>
      error instanceof ApiError && [403, 404].includes(error.status ?? 0)
        ? false
        : count < 1,
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (storyId: string) => ephemeralApi.deleteStory(storyId),
    onSuccess: (_v, storyId) => {
      toast("Story deleted.", "success");
      queryClient.removeQueries({ queryKey: ephemeralKeys.story(storyId) });
      queryClient.invalidateQueries({ queryKey: ephemeralKeys.storyFeed });
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the story. Please try again."),
  });
}

/* --------------------------------- reels --------------------------------- */

export function usePublishReel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      video: File;
      cover: File | null;
      caption: string | null;
      onProgress?: (stage: string) => void;
    }): Promise<string> => {
      input.onProgress?.("Uploading video…");
      const videoIntent: UploadIntent = await contentApi.createUploadIntent(
        input.video.type,
        input.video.size,
      );
      await uploadToProvider(videoIntent, input.video);
      input.onProgress?.("Verifying video…");
      const video = await contentApi.completeUpload(videoIntent.id);

      let coverId: string | null = null;
      if (input.cover) {
        input.onProgress?.("Uploading cover…");
        const coverIntent: UploadIntent = await contentApi.createUploadIntent(
          input.cover.type,
          input.cover.size,
        );
        await uploadToProvider(coverIntent, input.cover);
        input.onProgress?.("Verifying cover…");
        coverId = (await contentApi.completeUpload(coverIntent.id)).id;
      }
      input.onProgress?.("Publishing…");
      const reel = await ephemeralApi.publishReel(
        video.id,
        coverId,
        input.caption,
      );
      return reel.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ephemeralKeys.reelFeed });
      queryClient.invalidateQueries({ queryKey: contentKeys.explore });
      queryClient.invalidateQueries({ queryKey: ["user-reels"] });
    },
    onError: (error) =>
      toastError(toast, error, "Could not publish your reel. Please try again."),
  });
}

export function useReelFeed() {
  return useInfiniteQuery({
    queryKey: ephemeralKeys.reelFeed,
    queryFn: ({ pageParam }) => ephemeralApi.reelFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useUserReels(username: string | undefined) {
  return useInfiniteQuery({
    queryKey: ephemeralKeys.userReels(username ?? ""),
    queryFn: ({ pageParam }) => ephemeralApi.userReels(username ?? "", pageParam),
    enabled: Boolean(username),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

type ReelPages = { pages: { items: Reel[] }[] };

/** Bump a reel's comment_count everywhere it's cached, without refetching. */
function patchReelCommentCount(
  queryClient: QueryClient,
  reelId: string,
  delta: number,
) {
  const bump = (reel: Reel): Reel => ({
    ...reel,
    comment_count: Math.max(0, (reel.comment_count ?? 0) + delta),
  });
  queryClient.setQueryData<Reel>(ephemeralKeys.reel(reelId), (old) =>
    old ? bump(old) : old,
  );
  const patchPages = (old: ReelPages | undefined): ReelPages | undefined => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((r) => (r.id === reelId ? bump(r) : r)),
      })),
    };
  };
  queryClient.setQueriesData<ReelPages>(
    { queryKey: ephemeralKeys.reelFeed },
    patchPages,
  );
  queryClient.setQueriesData<ReelPages>(
    { queryKey: ["user-reels"] },
    patchPages,
  );
}

export function useReelComments(reelId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ephemeralKeys.reelComments(reelId ?? ""),
    queryFn: ({ pageParam }) =>
      ephemeralApi.reelComments(reelId ?? "", pageParam),
    enabled: Boolean(reelId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useCreateReelComment(reel: Reel) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({
      body,
      parentId,
    }: {
      body: string;
      parentId?: string | null;
    }) => ephemeralApi.createReelComment(reel.id, body, parentId ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ephemeralKeys.reelComments(reel.id),
      });
      patchReelCommentCount(queryClient, reel.id, 1);
    },
    onError: (error) =>
      toastError(toast, error, "Could not post your comment. Please try again."),
  });
}

export function useDeleteReelComment(reelId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (commentId: string) =>
      ephemeralApi.deleteReelComment(reelId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ephemeralKeys.reelComments(reelId),
      });
      patchReelCommentCount(queryClient, reelId, -1);
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the comment. Please try again."),
  });
}

export function useReel(reelId: string | undefined) {
  return useQuery({
    queryKey: ephemeralKeys.reel(reelId ?? ""),
    queryFn: () => ephemeralApi.getReel(reelId ?? ""),
    enabled: Boolean(reelId),
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}

export function useRecordReelView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reelId: string) => ephemeralApi.recordReelView(reelId),
    onSuccess: (result) => {
      queryClient.setQueryData<Reel>(
        ephemeralKeys.reel(result.reel.id),
        result.reel,
      );
      queryClient.setQueriesData<{ pages: { items: Reel[] }[] }>(
        { queryKey: ephemeralKeys.reelFeed },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((r) =>
                r.id === result.reel.id ? result.reel : r,
              ),
            })),
          };
        },
      );
    },
  });
}

export function useReelSave(reel: Reel) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () =>
      reel.saved
        ? ephemeralApi.unsaveReel(reel.id)
        : ephemeralApi.saveReel(reel.id),
    onMutate: async () => {
      const next = !reel.saved;
      const patch = (r: Reel): Reel => ({ ...r, saved: next });
      queryClient.setQueryData<Reel>(ephemeralKeys.reel(reel.id), patch(reel));
      queryClient.setQueriesData<{ pages: { items: Reel[] }[] }>(
        { queryKey: ephemeralKeys.reelFeed },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((r) => (r.id === reel.id ? patch(r) : r)),
            })),
          };
        },
      );
      return { next };
    },
    onError: (error, _v, context) => {
      if (context) {
        const patch = (r: Reel): Reel => ({ ...r, saved: !context.next });
        queryClient.setQueryData<Reel>(ephemeralKeys.reel(reel.id), (old) =>
          old ? patch(old) : old,
        );
      }
      toastError(toast, error, "Could not update your saved moments.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ephemeralKeys.savedReels });
    },
  });
}

export function useSavedReels() {
  return useInfiniteQuery({
    queryKey: ephemeralKeys.savedReels,
    queryFn: ({ pageParam }) => ephemeralApi.savedReels(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useReelLike(reel: Reel) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () =>
      reel.liked
        ? ephemeralApi.unlikeReel(reel.id)
        : ephemeralApi.likeReel(reel.id),
    onMutate: async () => {
      const next = !reel.liked;
      const patch = (r: Reel): Reel => ({
        ...r,
        liked: next,
        like_count: r.like_count + (next ? 1 : -1),
      });
      queryClient.setQueryData<Reel>(ephemeralKeys.reel(reel.id), patch(reel));
      queryClient.setQueriesData<{ pages: { items: Reel[] }[] }>(
        { queryKey: ephemeralKeys.reelFeed },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((r) => (r.id === reel.id ? patch(r) : r)),
            })),
          };
        },
      );
      return { next };
    },
    onError: (error, _v, context) => {
      if (context) {
        const patch = (r: Reel): Reel => ({
          ...r,
          liked: !context.next,
          like_count: r.like_count + (context.next ? -1 : 1),
        });
        queryClient.setQueryData<Reel>(ephemeralKeys.reel(reel.id), (old) =>
          old ? patch(old) : old,
        );
      }
      toastError(toast, error, "Could not update the like. Please try again.");
    },
  });
}

export function useDeleteReel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (reelId: string) => ephemeralApi.deleteReel(reelId),
    onSuccess: (_v, reelId) => {
      toast("Reel deleted.", "success");
      queryClient.removeQueries({ queryKey: ephemeralKeys.reel(reelId) });
      queryClient.invalidateQueries({ queryKey: ephemeralKeys.reelFeed });
      queryClient.invalidateQueries({ queryKey: ["user-reels"] });
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the reel. Please try again."),
  });
}
