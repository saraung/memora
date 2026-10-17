import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUserStories } from "@/features/ephemeral/hooks";
import { cn } from "@/lib/utils";

/**
 * Active stories of the profile owner. Rendered only when stories
 * exist — this is how a stranger-discovered public profile surfaces
 * its stories.
 */
export function ProfileStories({ username }: { username: string }) {
  const stories = useUserStories(username);

  if (stories.isPending) {
    return (
      <section
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
        aria-label="Loading stories"
      >
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="size-16 shrink-0 rounded-full" />
          ))}
        </div>
      </section>
    );
  }
  if (stories.isError || !stories.data) return null;

  const items = stories.data.pages.flatMap((p) => p.items);
  if (items.length === 0) return null;

  return (
    <section aria-label={`${username}'s stories`} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex gap-4 overflow-x-auto">
        {items.map((story) => (
          <Link
            key={story.id}
            to={`/stories/${story.id}`}
            aria-label={`Story from ${story.created_at}${story.viewed ? "" : ", unseen"}`}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "rounded-full",
                story.viewed ? "border border-line p-[3px]" : "story-ring",
              )}
            >
              <span className="block size-[3.4rem] overflow-hidden rounded-full border-2 border-surface bg-muted">
                {story.media.resource_type === "video" ? (
                  <video
                    src={story.media.secure_url}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  <img
                    src={story.media.secure_url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </span>
            </span>
            <span className="w-full truncate text-center text-xs text-2">
              {new Date(story.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
