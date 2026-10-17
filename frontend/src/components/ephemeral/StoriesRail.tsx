import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StoriesRailSkeleton } from "@/components/feedback/Skeletons";
import { useStoryFeed } from "@/features/ephemeral/hooks";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

function YouTile({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  return (
    <Link
      to="/stories/new"
      role="listitem"
      className="flex w-16 shrink-0 flex-col items-center gap-1.5"
      aria-label="Add to your story"
    >
        <span className="relative">
          <Avatar
            name={displayName || username}
            src={avatarUrl}
            size="lg"
            className="size-16"
          />
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-on-primary"
          >
            <Plus className="size-4" />
          </span>
        </span>
      <span className="w-full truncate text-center text-xs text-2">
        You
      </span>
    </Link>
  );
}

/**
 * Always-visible stories rail: the "Your story" entry point and an
 * inline empty hint render even when nobody has an active story, so
 * the surface is discoverable instead of vanishing.
 */
export function StoriesRail() {
  const { user } = useAuth();
  const feed = useStoryFeed();
  const groups = feed.data?.pages.flatMap((page) => page.items) ?? [];

  if (feed.isPending) {
    return <StoriesRailSkeleton />;
  }

  return (
    <section aria-label="Stories">
      <div className="flex items-center gap-4 overflow-x-auto py-1" role="list">
        {user && (
          <YouTile
            username={user.username}
            displayName={user.display_name}
            avatarUrl={user.avatar_url}
          />
        )}
        {groups.map((group) => {
          const firstUnseen =
            group.stories.find((s) => !s.viewed) ?? group.stories[0];
          if (!firstUnseen) return null;
          return (
            <Link
              key={group.author.id}
              to={`/stories/${firstUnseen.id}`}
              role="listitem"
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              aria-label={`${group.author.username}'s story${group.has_unseen ? ", unseen" : ""}`}
            >
              <span
                className={cn(
                  "rounded-full",
                  group.has_unseen
                    ? "story-ring"
                    : "border border-line p-[3px]",
                )}
              >
                <span className="block rounded-full border-2 border-surface">
                  <Avatar
                    name={group.author.display_name || group.author.username}
                    src={group.author.avatar_url}
                    className="size-[3.4rem] ring-0"
                  />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs text-2">
                {group.author.username}
              </span>
            </Link>
          );
        })}
        {!feed.isError && groups.length === 0 && (
          <p className="min-w-0 flex-1 text-sm text-3">
            No stories yet — stories from you and people you follow will
            appear here for 24 hours.
          </p>
        )}
      </div>
      {feed.isError && (
        <p className="mt-1 text-sm text-2">
          Couldn&apos;t load stories.{" "}
          <button
            type="button"
            onClick={() => feed.refetch()}
            className="cursor-pointer font-semibold text-primary hover:text-primary"
          >
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
