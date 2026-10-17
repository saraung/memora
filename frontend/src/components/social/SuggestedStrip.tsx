import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, UserPlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { socialApi } from "@/services/endpoints/social";
import { ApiError } from "@/services/api-client";
import { useSuggestedUsers } from "@/features/social/useSuggestedUsers";
import type { UserSummary } from "@/types/social";

function SuggestionCard({ user }: { user: UserSummary }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [followed, setFollowed] = useState(false);
  const follow = useMutation({
    mutationFn: () => socialApi.follow(user.id),
    onSuccess: (status) => {
      setFollowed(true);
      queryClient.invalidateQueries({ queryKey: ["suggested-users"] });
      toast(
        status === "requested"
          ? `Request sent to @${user.username}.`
          : `You're now following @${user.username}.`,
        "success",
      );
    },
    onError: (error: unknown) => {
      toast(
        error instanceof ApiError ? error.message : "Could not follow. Please try again.",
        "error",
      );
    },
  });

  return (
    <div className="flex w-36 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-4 text-center shadow-card">
      <Link to={`/u/${user.username}`} aria-label={`@${user.username}`}>
        <Avatar
          name={user.display_name || user.username}
          src={user.avatar_url}
          size="lg"
        />
      </Link>
      <div className="w-full">
        <Link
          to={`/u/${user.username}`}
          className="block truncate text-sm font-bold text-1 hover:underline"
        >
          {user.display_name}
        </Link>
        <p className="truncate text-xs text-3">@{user.username}</p>
      </div>
      <button
        type="button"
        onClick={() => follow.mutate()}
        disabled={follow.isPending || followed}
        className="mt-1 inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {followed ? (
          <>
            <Check className="size-3.5" aria-hidden />
            Following
          </>
        ) : (
          <>
            <UserPlus className="size-3.5" aria-hidden />
            {follow.isPending ? "…" : "Follow"}
          </>
        )}
      </button>
    </div>
  );
}

/** Cold-start strip: suggested accounts, shown while the graph is small. */
export function SuggestedStrip() {
  const suggested = useSuggestedUsers();

  if (suggested.isPending) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-label="Loading suggestions">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 w-36 shrink-0 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (suggested.isError || !suggested.data || suggested.data.length === 0) {
    return null;
  }

  return (
    <section aria-label="Suggested accounts">
      <h2 className="mb-2 text-sm font-display font-extrabold tracking-tight text-1">
        Suggested for you
      </h2>
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {suggested.data.map((user) => (
          <SuggestionCard key={user.id} user={user} />
        ))}
      </div>
    </section>
  );
}
