import { Hammer } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/feedback/StateViews";

/** Stub for routes whose backend milestone hasn't landed yet. */
export function PlaceholderPage({
  title,
  message = "This surface arrives with its backend milestone. The design system is ready when it does.",
}: {
  title: string;
  message?: string;
}) {
  return (
    <PageContainer>
      <EmptyState
        title={title}
        message={message}
        icon={<Hammer className="size-6 text-primary" aria-hidden />}
      />
    </PageContainer>
  );
}
