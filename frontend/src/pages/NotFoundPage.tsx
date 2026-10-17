import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/feedback/StateViews";

export function NotFoundPage() {
  return (
    <PageContainer>
      <EmptyState
        title="Page not found"
        message="The page you're looking for doesn't exist or was moved."
        icon={<Compass className="size-6 text-primary" aria-hidden />}
        action={
          <Link to="/">
            <Button>Go home</Button>
          </Link>
        }
      />
    </PageContainer>
  );
}
