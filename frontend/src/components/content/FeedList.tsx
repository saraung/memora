import { Link } from "react-router-dom";
import { Fragment } from "react";
import { Flame, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { FeedSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { PostCard } from "@/components/content/PostCard";
import { SuggestedStrip } from "@/components/social/SuggestedStrip";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import type { Post } from "@/types/content";

interface FeedQuery {
  data: { pages: { items: Post[] }[] } | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
}

export function FeedList({
  query,
  emptyTitle,
  emptyMessage,
  showSuggestions = false,
}: {
  query: FeedQuery;
  emptyTitle: string;
  emptyMessage: string;
  /** Show the suggested-accounts strip + discovery labels (home only). */
  showSuggestions?: boolean;
}) {
  const sentinelRef = useInfiniteScroll(
    () => query.fetchNextPage(),
    Boolean(query.hasNextPage) && !query.isFetchingNextPage,
  );

  if (query.isPending) {
    return <FeedSkeleton />;
  }

  if (query.isError) {
    return (
      <ErrorState title="Could not load posts" onRetry={() => query.refetch()} />
    );
  }

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const hasDiscovery = items.some((p) => p.source === "discovery");

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        icon={<ImagePlus className="size-6 text-primary" aria-hidden />}
        action={
          <Link to="/compose">
            <Button size="sm">Share your first post</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {showSuggestions && hasDiscovery && <SuggestedStrip />}
      {items.map((post, i) => (
        <Fragment key={post.id}>
          {post.source === "discovery" &&
            (i === 0 || items[i - 1]?.source !== "discovery") && (
              <p className="flex items-center gap-1.5 text-xs font-black tracking-wide text-3 uppercase">
                <Flame className="size-4 text-amber-500" aria-hidden />
                Popular right now
              </p>
            )}
          <PostCard post={post} />
        </Fragment>
      ))}
      {query.hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {query.isFetchingNextPage ? (
            <Spinner />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
