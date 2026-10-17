import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReelPlayerSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { ReelPlayer } from "@/components/ephemeral/ReelPlayer";
import { useReelFeed } from "@/features/ephemeral/hooks";
import { cn } from "@/lib/utils";

// Edge-to-edge immersive stage: cancels the shell padding and fills the
// viewport below the mobile top bar (desktop has no chrome to subtract).
// Transparent so it shares the app canvas; the dark backdrop lives on the
// video card itself.
const STAGE =
  "-mx-4 -mt-6 -mb-24 h-[calc(100dvh_-_3.5rem)] md:-mx-8 md:-mb-10 md:h-[100dvh]";

export function MomentsPage() {
  const feed = useReelFeed();
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());

  const items = useMemo(
    () => feed.data?.pages.flatMap((p) => p.items) ?? [],
    [feed.data],
  );

  useEffect(() => {
    if (items.length > 0 && visibleId === null) setVisibleId(items[0].id);
  }, [items, visibleId]);

  // Track which moment fills the stage.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-reel-id");
            if (id) setVisibleId(id);
          }
        }
      },
      { threshold: 0.6 },
    );
    refs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  // Load the next page as the last moment comes into view.
  useEffect(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      const last = items[items.length - 1];
      if (last && visibleId === last.id) feed.fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleId]);

  // Up/Down arrows move between moments, like a reel viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const index = items.findIndex((r) => r.id === visibleId);
      if (index === -1) return;
      const next = items[e.key === "ArrowDown" ? index + 1 : index - 1];
      const node = next && refs.current.get(next.id);
      if (node) {
        e.preventDefault();
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, visibleId]);

  if (feed.isPending) {
    return (
      <div className={cn(STAGE, "flex items-center justify-center")}>
        <ReelPlayerSkeleton />
      </div>
    );
  }

  if (feed.isError) {
    return (
      <PageContainer>
        <ErrorState title="Could not load moments" onRetry={() => feed.refetch()} />
      </PageContainer>
    );
  }

  if (items.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          title="No moments yet"
          message="Short videos from across Memora will play here."
          icon={<Clapperboard className="size-6 text-primary" aria-hidden />}
          action={
            <Link
              to="/moments/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-strong"
            >
              <Plus className="size-4" aria-hidden />
              Share your first moment
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <div
      className={cn(
        STAGE,
        "snap-y snap-mandatory overflow-y-auto overscroll-y-contain",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {items.map((reel) => (
        <section
          key={reel.id}
          data-reel-id={reel.id}
          ref={(node) => {
            if (node) refs.current.set(reel.id, node);
            else refs.current.delete(reel.id);
          }}
          className="flex h-full snap-start snap-always items-center justify-center"
        >
          <ReelPlayer reel={reel} active={visibleId === reel.id} />
        </section>
      ))}
      <div className="sr-only" role="status" aria-live="polite">
        {feed.isFetchingNextPage ? "Loading more moments" : ""}
      </div>
    </div>
  );
}
