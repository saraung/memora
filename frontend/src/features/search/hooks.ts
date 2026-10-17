import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { searchApi } from "@/services/endpoints/search";
import type { PostPage } from "@/types/content";
import type { HashtagPage, UserSearchPage } from "@/types/search";

function usePagedSearch<TPage extends { has_more: boolean; next_cursor: string | null }>(
  key: readonly unknown[],
  query: string,
  queryFn: (cursor?: string) => Promise<TPage>,
  enabled: boolean,
) {
  return useInfiniteQuery<
    TPage,
    Error,
    InfiniteData<TPage>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: [...key, query],
    queryFn: ({ pageParam }) => queryFn(pageParam),
    enabled: enabled && query.trim().length > 0,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export function useUserSearch(query: string) {
  return usePagedSearch(
    ["user-search"],
    query,
    (cursor) => searchApi.users(query, cursor),
    true,
  );
}

export function usePostSearch(query: string) {
  return usePagedSearch(
    ["post-search"],
    query,
    (cursor) => searchApi.posts(query, cursor),
    true,
  );
}

export function useHashtagSearch(query: string) {
  const normalized = query.replace(/^#+/, "");
  return usePagedSearch(
    ["hashtag-search"],
    normalized,
    (cursor) => searchApi.hashtags(normalized, cursor),
    true,
  );
}

export function useTagPosts(tag: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["tag-posts", tag?.toLowerCase() ?? ""],
    queryFn: ({ pageParam }) => searchApi.tagPosts(tag ?? "", pageParam),
    enabled: Boolean(tag),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: PostPage) =>
      lastPage.has_more ? (lastPage.next_cursor ?? undefined) : undefined,
  });
}

export type { UserSearchPage, HashtagPage };
