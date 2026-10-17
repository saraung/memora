import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Flag, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageContainer";
import { PostCardSkeleton } from "@/components/feedback/Skeletons";
import { ErrorState, EmptyState } from "@/components/feedback/StateViews";
import { PostCard } from "@/components/content/PostCard";
import { CommentSection } from "@/components/content/Comments";
import { useReport } from "@/components/moderation/ReportDialog";
import { useDeletePost, usePost } from "@/features/content/hooks";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";

export function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const post = usePost(postId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const remove = useDeletePost();
  const { openReport } = useReport();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (post.isPending) {
    return (
      <PageContainer className="space-y-4" aria-label="Loading post">
        <PostCardSkeleton />
        <Skeleton className="h-40 rounded-2xl" />
      </PageContainer>
    );
  }

  if (post.isError || !post.data) {
    const notFound =
      post.error instanceof ApiError && post.error.status === 404;
    return (
      <PageContainer>
        {notFound ? (
          <EmptyState
            title="Post not available"
            message="This post doesn't exist, was deleted, or you don't have access."
            action={
              <Link to="/">
                <Button size="sm">Back to feed</Button>
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="Could not load this post"
            onRetry={() => post.refetch()}
          />
        )}
      </PageContainer>
    );
  }

  const data = post.data;
  const own = user?.id === data.author.id;

  return (
    <PageContainer className="space-y-4">
      <div className="flex justify-end">
        <DropdownMenu
          label="Post actions"
          trigger={
            <button
              type="button"
              aria-label="Post actions"
              className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-2 shadow-card transition-colors hover:bg-muted"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          }
          items={
            own
              ? [
                  {
                    label: "Delete post",
                    danger: true,
                    onSelect: () => setConfirmOpen(true),
                  },
                ]
              : [
                  {
                    label: "Report post",
                    icon: <Flag className="size-4" aria-hidden />,
                    onSelect: () =>
                      openReport({
                        type: "post",
                        id: data.id,
                        label: `by @${data.author.username}`,
                      }),
                  },
                ]
          }
        />
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() =>
            remove.mutate(data.id, { onSuccess: () => navigate("/") })
          }
          title="Delete this post?"
          description="The post and its comments will be permanently removed."
          confirmLabel="Delete"
          danger
          loading={remove.isPending}
        />
      </div>
      <PostCard post={data} />
      <CommentSection post={data} />
    </PageContainer>
  );
}
