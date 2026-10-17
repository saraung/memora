import { useParams } from "react-router-dom";
import { StoryViewer } from "@/components/ephemeral/StoryViewer";
import { EmptyState } from "@/components/feedback/StateViews";

export function StoryPage() {
  const { storyId } = useParams<{ storyId: string }>();
  if (!storyId) {
    return <EmptyState title="Story not available" />;
  }
  return <StoryViewer startStoryId={storyId} />;
}
