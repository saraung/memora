import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileSaved } from "@/components/content/ProfileSaved";

/** Private saved posts and moments for the authenticated user. */
export function BookmarksPage() {
  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        Saved
      </h1>
      <ProfileSaved />
    </PageContainer>
  );
}
