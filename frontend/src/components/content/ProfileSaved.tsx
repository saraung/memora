import { Link } from "react-router-dom";
import { Bookmark, Play } from "lucide-react";
import { FeedList } from "@/components/content/FeedList";
import { FeedSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { useBookmarks } from "@/features/content/hooks";
import { useSavedReels } from "@/features/ephemeral/hooks";

/** Private saved posts + moments, shown on the current user's own profile. */
export function ProfileSaved() {
  const posts = useBookmarks();
  const reels = useSavedReels();

  if (posts.isPending || reels.isPending) {
    return <FeedSkeleton />;
  }

  if (posts.isError || reels.isError) {
    return (
      <ErrorState
        title="Could not load saved items"
        onRetry={() => {
          posts.refetch();
          reels.refetch();
        }}
      />
    );
  }

  const postItems = posts.data?.pages.flatMap((page) => page.items) ?? [];
  const reelItems = reels.data?.pages.flatMap((page) => page.items) ?? [];

  if (postItems.length === 0 && reelItems.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        message="Tap the bookmark icon on any post or moment to find it here. Only you can see this."
        icon={<Bookmark className="size-6 text-primary" aria-hidden />}
      />
    );
  }

  return (
    <div className="space-y-6">
      {reelItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-black tracking-wide text-3 uppercase">
            Saved moments
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {reelItems.map((reel) => (
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
              </Link>
            ))}
          </div>
        </section>
      )}
      {postItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-black tracking-wide text-3 uppercase">
            Saved posts
          </h2>
          <FeedList
            query={posts}
            emptyTitle="No saved posts"
            emptyMessage="Tap the bookmark icon on any post to find it here."
          />
        </section>
      )}
    </div>
  );
}
