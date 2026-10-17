import { Link } from "react-router-dom";
import { MailWarning, Plus, UserPlus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { FeedList } from "@/components/content/FeedList";
import { StoriesRail } from "@/components/ephemeral/StoriesRail";
import { useFeed } from "@/features/content/hooks";
import { useFollowRequests } from "@/features/social/hooks";
import { useAuth } from "@/hooks/useAuth";

/** Home: stories rail, verification + request banners, chronological feed. */
export function FeedPage() {
  const { user } = useAuth();
  const feed = useFeed();
  const requests = useFollowRequests();
  const pendingCount = requests.data?.length ?? 0;

  return (
    <PageContainer className="space-y-4">
      <StoriesRail />

      {user && !user.is_verified && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-500/25 dark:bg-amber-400/10"
        >
          <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-bold text-amber-900 dark:text-amber-100">Email not verified. </span>
            Check your inbox for the verification link.
          </p>
        </div>
      )}

      {pendingCount > 0 && (
        <Link
          to="/requests"
          className="flex items-center gap-3 rounded-2xl border border-line-strong bg-primary-soft px-4 py-3.5 transition-colors hover:bg-primary-soft"
        >
          <UserPlus className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-primary">
            {pendingCount} pending follow {pendingCount === 1 ? "request" : "requests"} — review now
          </p>
        </Link>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-1">
          Home
        </h1>
        <Link
          to="/compose"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-strong"
        >
          <Plus className="size-4" aria-hidden />
          New post
        </Link>
      </div>

      <FeedList
        query={feed}
        emptyTitle="Your feed is quiet"
        emptyMessage="Follow people to fill your feed, or share your first post."
        showSuggestions
      />
    </PageContainer>
  );
}
