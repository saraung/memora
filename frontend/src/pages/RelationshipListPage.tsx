import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  CardListSkeleton,
  PageHeaderSkeleton,
} from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { UserListItem } from "@/components/social/UserListItem";
import { useProfile, useRelationshipList } from "@/features/social/hooks";
import { ApiError } from "@/services/api-client";

export function RelationshipListPage({
  kind,
}: {
  kind: "followers" | "following";
}) {
  const { username } = useParams<{ username: string }>();
  const profile = useProfile(username);
  const list = useRelationshipList(username, kind);
  const title = kind === "followers" ? "Followers" : "Following";

  if (profile.isPending || list.isPending) {
    return (
      <PageContainer className="space-y-4" aria-label={`Loading ${kind}`}>
        <PageHeaderSkeleton />
        <CardListSkeleton />
      </PageContainer>
    );
  }

  if (profile.isError || list.isError) {
    const error = profile.error ?? list.error;
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <PageContainer>
        {notFound ? (
          <EmptyState
            title={`${title} not available`}
            message="This profile doesn't exist, is private, or you don't have access."
            action={
              <Link to={username ? `/u/${username}` : "/"}>
                <Button variant="outline" size="sm">
                  Back to profile
                </Button>
              </Link>
            }
          />
        ) : (
          <ErrorState
            title={`Could not load ${kind}`}
            onRetry={() => list.refetch()}
          />
        )}
      </PageContainer>
    );
  }

  const items = list.data.pages.flatMap((page) => page.items);

  return (
    <PageContainer className="space-y-4">
      <div>
        <Link
          to={`/u/${username}`}
          className="text-sm font-semibold text-primary hover:text-primary"
        >
          ← @{username}
        </Link>
        <h1 className="mt-1 text-2xl font-display font-extrabold tracking-tight text-1">
          {title}
        </h1>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={kind === "followers" ? "No followers yet" : "Not following anyone yet"}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
          {items.map((user) => (
            <UserListItem key={user.id} user={user} />
          ))}
          {list.hasNextPage && (
            <div className="flex justify-center p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => list.fetchNextPage()}
                loading={list.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          )}
          {list.isFetching && !list.isFetchingNextPage && (
            <div className="flex justify-center p-3">
              <Spinner />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
