import { Link } from "react-router-dom";
import { Clapperboard, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GridSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { useUserReels } from "@/features/ephemeral/hooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

export function ProfileMoments({ username }: { username: string }) {
  const grid = useUserReels(username);
  const sentinelRef = useInfiniteScroll(
    () => grid.fetchNextPage(),
    Boolean(grid.hasNextPage) && !grid.isFetchingNextPage,
  );

  if (grid.isPending) {
    return <GridSkeleton count={9} />;
  }

  if (grid.isError) {
    return (
      <ErrorState
        title="Could not load moments"
        onRetry={() => grid.refetch()}
      />
    );
  }

  const items = grid.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No moments yet"
        message="Short videos from this account will show up here."
        icon={<Clapperboard className="size-6 text-primary" aria-hidden />}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((reel) => (
          <Link
            key={reel.id}
            to={`/reels/${reel.id}`}
            aria-label={`Moment by @${reel.author.username}`}
            className="group relative block aspect-[9/16] overflow-hidden rounded-xl bg-ink-950"
          >
            {reel.cover ? (
              <img
                src={reel.cover.secure_url}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <video
                src={reel.video.secure_url}
                muted
                playsInline
                preload="metadata"
                className="size-full object-cover"
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <Play className="size-7 fill-white text-white" aria-hidden />
            </span>
            <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 text-xs font-bold text-white drop-shadow">
              <Play className="size-3.5 fill-white" aria-hidden />
              {reel.view_count}
            </span>
          </Link>
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
