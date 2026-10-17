import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GridSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { PostTile } from "@/components/content/PostTile";
import { useProfilePosts } from "@/features/content/hooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

export function ProfileGrid({ username }: { username: string }) {
  const grid = useProfilePosts(username);
  const sentinelRef = useInfiniteScroll(
    () => grid.fetchNextPage(),
    Boolean(grid.hasNextPage) && !grid.isFetchingNextPage,
  );

  if (grid.isPending) {
    return <GridSkeleton count={9} />;
  }

  if (grid.isError) {
    return (
      <ErrorState title="Could not load posts" onRetry={() => grid.refetch()} />
    );
  }

  const items = grid.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No posts yet"
        message="When this account shares photos or videos, they'll show up here."
        icon={<ImagePlus className="size-6 text-primary" aria-hidden />}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((post) => (
          <PostTile key={post.id} post={post} />
        ))}
      </div>
      {grid.hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => grid.fetchNextPage()}
            loading={grid.isFetchingNextPage}
          >
            Load more
          </Button>
          <div ref={sentinelRef} aria-hidden className="w-0" />
        </div>
      )}
    </div>
  );
}
