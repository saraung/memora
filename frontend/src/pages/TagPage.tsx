import { Link, useParams } from "react-router-dom";
import { Hash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageContainer";
import { GridSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { PostTile } from "@/components/content/PostTile";
import { useTagPosts } from "@/features/search/hooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { ApiError } from "@/services/api-client";

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const posts = useTagPosts(tag);
  const sentinelRef = useInfiniteScroll(
    () => posts.fetchNextPage(),
    Boolean(posts.hasNextPage) && !posts.isFetchingNextPage,
  );

  if (posts.isPending) {
    return (
      <PageContainer className="space-y-4" aria-label="Loading tag">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <GridSkeleton />
      </PageContainer>
    );
  }

  if (posts.isError) {
    const notFound =
      posts.error instanceof ApiError && posts.error.status === 404;
    return (
      <PageContainer>
        {notFound ? (
          <EmptyState
            title={`#${tag} isn't browsable`}
            message="The tag may not exist."
          />
        ) : (
          <ErrorState
            title="Could not load this tag"
            onRetry={() => posts.refetch()}
          />
        )}
      </PageContainer>
    );
  }

  const items = posts.data.pages.flatMap((p) => p.items);

  return (
    <PageContainer>
      <Link
        to="/search"
        className="text-sm font-semibold text-primary hover:text-primary"
      >
        ← Search
      </Link>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-display font-extrabold tracking-tight text-1">
        <Hash className="size-6 text-primary" aria-hidden />
        {tag}
      </h1>
      <p className="mt-1 text-sm text-2">
        {items.length} visible {items.length === 1 ? "post" : "posts"} · private
        content is excluded
      </p>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={`No visible posts for #${tag}`}
            message="Posts with this tag will show up here."
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {items.map((post) => (
            <PostTile key={post.id} post={post} />
          ))}
        </div>
      )}
      {posts.hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => posts.fetchNextPage()}
            loading={posts.isFetchingNextPage}
          >
            Load more
          </Button>
          <div ref={sentinelRef} aria-hidden className="w-0" />
        </div>
      )}
    </PageContainer>
  );
}
