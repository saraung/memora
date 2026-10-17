import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { socialKeys } from "@/features/social/hooks";
import { ApiError } from "@/services/api-client";
import {
  contentApi,
  uploadToProvider,
  type UploadIntent,
} from "@/services/endpoints/content";
import type { Post } from "@/types/content";

export const contentKeys = {
  post: (id: string) => ["post", id] as const,
  feed: ["feed"] as const,
  explore: ["explore"] as const,
  profilePosts: (username: string) =>
    ["profile-posts", username.toLowerCase()] as const,
  bookmarks: ["bookmarks"] as const,
  comments: (postId: string) => ["comments", postId] as const,
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

/* ------------------------------- composer ------------------------------- */

export interface ComposerFile {
  file: File;
  preview: string;
  altText: string;
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      caption: string | null;
      files: ComposerFile[];
      onProgress?: (done: number, total: number) => void;
    }): Promise<Post> => {
      const mediaIds: { media_id: string; alt_text?: string }[] = [];
      let done = 0;
      for (const item of input.files) {
        const intent: UploadIntent = await contentApi.createUploadIntent(
          item.file.type,
          item.file.size,
        );
        await uploadToProvider(intent, item.file);
        const asset = await contentApi.completeUpload(intent.id);
        mediaIds.push({
          media_id: asset.id,
          alt_text: item.altText.trim() || undefined,
        });
        done += 1;
        input.onProgress?.(done, input.files.length);
      }
      return contentApi.createPost(input.caption, mediaIds);
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: contentKeys.feed });
      queryClient.invalidateQueries({ queryKey: contentKeys.explore });
      queryClient.invalidateQueries({
        queryKey: contentKeys.profilePosts(post.author.username),
      });
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
    onError: (error) =>
      toastError(toast, error, "Could not publish your post. Please try again."),
  });
}

/* --------------------------------- posts --------------------------------- */

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: contentKeys.post(postId ?? ""),
    queryFn: () => contentApi.getPost(postId ?? ""),
    enabled: Boolean(postId),
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (postId: string) => contentApi.deletePost(postId),
    onSuccess: (_v, postId) => {
      toast("Post deleted.", "success");
      queryClient.removeQueries({ queryKey: contentKeys.post(postId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.feed });
      queryClient.invalidateQueries({ queryKey: contentKeys.explore });
      queryClient.invalidateQueries({ queryKey: contentKeys.bookmarks });
      queryClient.invalidateQueries({ queryKey: socialKeys.me });
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the post. Please try again."),
  });
}

function patchPostEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  patch: (post: Post) => Post,
) {
  for (const key of [
    contentKeys.feed,
    contentKeys.explore,
    contentKeys.bookmarks,
  ]) {
    queryClient.setQueriesData<{ pages: { items: Post[] }[] }>(
      { queryKey: key },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((p) => (p.id === postId ? patch(p) : p)),
          })),
        };
      },
    );
  }
  queryClient.setQueryData<Post>(contentKeys.post(postId), (old) =>
    old ? patch(old) : old,
  );
}

export function useLike(post: Post) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () =>
      post.liked ? contentApi.unlike(post.id) : contentApi.like(post.id),
    onMutate: async () => {
      const next = !post.liked;
      patchPostEverywhere(queryClient, post.id, (p) => ({
        ...p,
        liked: next,
        like_count: p.like_count + (next ? 1 : -1),
      }));
      return { next };
    },
    onError: (error, _v, context) => {
      if (context) {
        patchPostEverywhere(queryClient, post.id, (p) => ({
          ...p,
          liked: !context.next,
          like_count: p.like_count + (context.next ? -1 : 1),
        }));
      }
      toastError(toast, error, "Could not update the like. Please try again.");
    },
  });
}

export function useBookmark(post: Post) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () =>
      post.bookmarked
        ? contentApi.unbookmark(post.id)
        : contentApi.bookmark(post.id),
    onMutate: async () => {
      const next = !post.bookmarked;
      patchPostEverywhere(queryClient, post.id, (p) => ({
        ...p,
        bookmarked: next,
      }));
      return { next };
    },
    onError: (error, _v, context) => {
      if (context) {
        patchPostEverywhere(queryClient, post.id, (p) => ({
          ...p,
          bookmarked: !context.next,
        }));
      }
      toastError(toast, error, "Could not update the bookmark. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contentKeys.bookmarks });
    },
  });
}

/* ---------------------------------- feed ---------------------------------- */

function useInfinitePosts(
  key: readonly unknown[],
  queryFn: (cursor?: string) => Promise<{ items: Post[]; next_cursor: string | null; has_more: boolean }>,
) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useFeed() {
  return useInfinitePosts(contentKeys.feed, (cursor) => contentApi.feed(cursor));
}

export function useExplore() {
  return useInfinitePosts(contentKeys.explore, (cursor) =>
    contentApi.explore(cursor),
  );
}

export function useProfilePosts(username: string | undefined) {
  return useInfiniteQuery({
    queryKey: contentKeys.profilePosts(username ?? ""),
    queryFn: ({ pageParam }) =>
      contentApi.profilePosts(username ?? "", pageParam),
    enabled: Boolean(username),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useBookmarks() {
  return useInfinitePosts(contentKeys.bookmarks, (cursor) =>
    contentApi.bookmarks(cursor),
  );
}

/* -------------------------------- comments -------------------------------- */

export function useComments(postId: string | undefined) {
  return useInfiniteQuery({
    queryKey: contentKeys.comments(postId ?? ""),
    queryFn: ({ pageParam }) => contentApi.comments(postId ?? "", pageParam),
    enabled: Boolean(postId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      body,
      parentId,
    }: {
      body: string;
      parentId?: string | null;
    }) => contentApi.createComment(postId, body, parentId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.comments(postId),
      });
      queryClient.invalidateQueries({ queryKey: contentKeys.post(postId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.feed });
    },
    onError: (error) =>
      toastError(toast, error, "Could not post your comment. Please try again."),
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (commentId: string) => contentApi.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.comments(postId),
      });
      queryClient.invalidateQueries({ queryKey: contentKeys.post(postId) });
      queryClient.invalidateQueries({ queryKey: contentKeys.feed });
    },
    onError: (error) =>
      toastError(toast, error, "Could not delete the comment. Please try again."),
  });
}
