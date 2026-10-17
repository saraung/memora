import { Link } from "react-router-dom";
import { Check, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  ListRowsSkeleton,
  PageHeaderSkeleton,
} from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import {
  useDecideRequest,
  useFollowRequests,
} from "@/features/social/hooks";

export function RequestsPage() {
  const requests = useFollowRequests();
  const decide = useDecideRequest();

  if (requests.isPending) {
    return (
      <PageContainer className="space-y-4">
        <PageHeaderSkeleton />
        <ListRowsSkeleton withAction />
      </PageContainer>
    );
  }

  if (requests.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load follow requests"
          onRetry={() => requests.refetch()}
        />
      </PageContainer>
    );
  }

  const items = requests.data;

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        Follow requests
      </h1>
      {items.length === 0 ? (
        <EmptyState
          title="No pending requests"
          message="When someone asks to follow your private account, they'll show up here."
          icon={<UserPlus className="size-6 text-primary" aria-hidden />}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <Avatar
                name={item.requester.display_name || item.requester.username}
                src={item.requester.avatar_url}
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/u/${item.requester.username}`}
                  className="block truncate text-sm font-bold text-1 hover:underline"
                >
                  {item.requester.display_name}
                </Link>
                <p className="truncate text-sm text-2">
                  @{item.requester.username} wants to follow you
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    decide.mutate({ id: item.id, approve: true })
                  }
                  loading={decide.isPending}
                  aria-label={`Approve @${item.requester.username}`}
                >
                  <Check className="size-4" aria-hidden />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    decide.mutate({ id: item.id, approve: false })
                  }
                  loading={decide.isPending}
                  aria-label={`Reject @${item.requester.username}`}
                >
                  <X className="size-4" aria-hidden />
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
