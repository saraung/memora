import { useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReelPlayer } from "@/components/ephemeral/ReelPlayer";
import { ReelPlayerSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { useReel } from "@/features/ephemeral/hooks";
import { ApiError } from "@/services/api-client";

export function ReelPage() {
  const { reelId } = useParams<{ reelId: string }>();
  const navigate = useNavigate();
  const reel = useReel(reelId);

  if (reel.isPending) {
    return (
      <div className="-mx-4 flex h-[calc(100dvh_-_10rem)] items-center justify-center md:mx-0 md:h-auto">
        <ReelPlayerSkeleton />
      </div>
    );
  }

  if (reel.isError || !reel.data) {
    const notFound =
      reel.error instanceof ApiError && reel.error.status === 404;
    return (
      <PageContainer>
        {notFound ? (
          <EmptyState
            title="Moment not available"
            message="This moment was deleted, or you don't have access to it."
          />
        ) : (
          <ErrorState
            title="Could not load this moment"
            onRetry={() => reel.refetch()}
          />
        )}
      </PageContainer>
    );
  }

  return (
    <div className="-mx-4 flex h-[calc(100dvh_-_10rem)] items-center justify-center md:mx-0 md:h-auto">
      <ReelPlayer reel={reel.data} active onDeleted={() => navigate(-1)} />
    </div>
  );
}
