import { Compass } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { GridSkeleton } from "@/components/feedback/Skeletons";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { PostTile } from "@/components/content/PostTile";
import { useExplore } from "@/features/content/hooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

export function ExplorePage() {
  const explore = useExplore();
  const sentinelRef = useInfiniteScroll(
    () => explore.fetchNextPage(),
    Boolean(explore.hasNextPage) && !explore.isFetchingNextPage,
  );

  const items = explore.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        Explore
      </h1>

      {explore.isPending ? (
        <GridSkeleton />
      ) : explore.isError ? (
        <ErrorState
          title="Could not load explore"
          onRetry={() => explore.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing to explore yet"
          message="Public posts from across Memora will show up here."
          icon={<Compass className="size-6 text-primary" aria-hidden />}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {items.map((post) => (
              <PostTile key={post.id} post={post} />
            ))}
          </div>
          {explore.hasNextPage && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
