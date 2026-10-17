import { useState } from "react";
import { Link } from "react-router-dom";
import { Hash, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, type Tab } from "@/components/ui/Tabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { PostCardSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { PostCard } from "@/components/content/PostCard";
import { UserListItem } from "@/components/social/UserListItem";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  useHashtagSearch,
  usePostSearch,
  useUserSearch,
} from "@/features/search/hooks";
import type { SearchTab } from "@/types/search";

const TABS: Tab[] = [
  { id: "people", label: "People" },
  { id: "posts", label: "Posts" },
  { id: "tags", label: "Tags" },
];

function PeopleResults({ query }: { query: string }) {
  const search = useUserSearch(query);
  const sentinelRef = useInfiniteScroll(
    () => search.fetchNextPage(),
    Boolean(search.hasNextPage) && !search.isFetchingNextPage,
  );
  if (search.isPending) {
    return (
      <div
        className="rounded-2xl border border-line bg-surface p-2 shadow-card"
        aria-label="Searching people"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (search.isError) {
    return <ErrorState title="Search failed" onRetry={() => search.refetch()} />;
  }
  const items = search.data.pages.flatMap((p) => p.items);
  if (items.length === 0) {
    return (
      <EmptyState
        title={`No people found for "${query}"`}
        message="Try a different spelling or username."
      />
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
      {items.map((u) => (
        <UserListItem key={u.id} user={u} />
      ))}
      {search.hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => search.fetchNextPage()}
            loading={search.isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function PostsResults({ query }: { query: string }) {
  const search = usePostSearch(query);
  const sentinelRef = useInfiniteScroll(
    () => search.fetchNextPage(),
    Boolean(search.hasNextPage) && !search.isFetchingNextPage,
  );
  if (search.isPending) {
    return (
      <div className="space-y-4" aria-label="Searching posts">
        <PostCardSkeleton />
      </div>
    );
  }
  if (search.isError) {
    return <ErrorState title="Search failed" onRetry={() => search.refetch()} />;
  }
  const items = search.data.pages.flatMap((p) => p.items);
  if (items.length === 0) {
    return (
      <EmptyState
        title={`No posts found for "${query}"`}
        message="Try different words, or browse a hashtag like #memories."
      />
    );
  }
  return (
    <div className="space-y-4">
      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {search.hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => search.fetchNextPage()}
            loading={search.isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function TagsResults({ query }: { query: string }) {
  const search = useHashtagSearch(query);
  if (search.isPending) {
    return (
      <div
        className="rounded-2xl border border-line bg-surface p-2 shadow-card"
        aria-label="Searching tags"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (search.isError) {
    return <ErrorState title="Search failed" onRetry={() => search.refetch()} />;
  }
  const items = search.data.pages.flatMap((p) => p.items);
  if (items.length === 0) {
    return (
      <EmptyState
        title={`No tags found for "${query}"`}
        message="Hashtags appear here once someone uses them in a post."
      />
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
      {items.map((tag) => (
        <Link
          key={tag.tag}
          to={`/h/${tag.tag}`}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
            <Hash className="size-5 text-primary" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-1">
              #{tag.tag}
            </span>
            <span className="block text-xs text-2">
              {tag.usage_count} {tag.usage_count === 1 ? "post" : "posts"}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function SearchPage() {
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<SearchTab>("people");
  const query = useDebouncedValue(input.trim(), 300);

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">Search</h1>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-3"
          aria-hidden
        />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="People, posts, #tags…"
          aria-label="Search"
          autoComplete="off"
          className="pl-10"
        />
      </div>
      <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as SearchTab)} />
      {!query ? (
        <EmptyState
          title="Search Memora"
          message="Find people by name or username, posts by words or #tags."
          icon={<Search className="size-6 text-primary" aria-hidden />}
        />
      ) : tab === "people" ? (
        <PeopleResults query={query} />
      ) : tab === "posts" ? (
        <PostsResults query={query} />
      ) : (
        <TagsResults query={query} />
      )}
    </PageContainer>
  );
}
