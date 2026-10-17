import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/feedback/StateViews";
import {
  useDeleteStory,
  useStory,
  useStoryFeed,
  useStoryViewers,
  useViewStory,
} from "@/features/ephemeral/hooks";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuthorStories } from "@/types/ephemeral";

const VIEW_MS = 5000;

function flatten(groups: AuthorStories[]): { group: number; story: number }[] {
  const out: { group: number; story: number }[] = [];
  groups.forEach((g, gi) =>
    g.stories.forEach((_, si) => out.push({ group: gi, story: si })),
  );
  return out;
}

export function StoryViewer({ startStoryId }: { startStoryId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feed = useStoryFeed();
  const view = useViewStory();
  const remove = useDeleteStory();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groups = useMemo(
    () => feed.data?.pages.flatMap((p) => p.items) ?? [],
    [feed.data],
  );
  const order = useMemo(() => flatten(groups), [groups]);
  const startIndex = useMemo(
    () =>
      Math.max(
        0,
        order.findIndex(({ group, story }) => groups[group]?.stories[story]?.id === startStoryId),
      ),
    [order, groups, startStoryId],
  );
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = order[index];
  const story = current ? groups[current.group]?.stories[current.story] : undefined;

  // Deep-link fallback: story not in the loaded feed (e.g. a stranger's
  // story opened from their profile). Rendered directly when fetched.
  const direct = useStory(!story && !feed.isPending ? startStoryId : undefined);
  const display = story ?? direct.data;
  const standalone = !story && !!direct.data;

  // Record the view (idempotent server-side) and keep the URL in sync.
  useEffect(() => {
    if (display && !display.viewed) view.mutate(display.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display?.id]);

  useEffect(() => {
    if (story) navigate(`/stories/${story.id}`, { replace: true });
  }, [story, navigate]);

  // Progress timer; videos drive completion via onEnded.
  // Standalone (deep-linked) stories hold on the single segment.
  useEffect(() => {
    setProgress(0);
    if (!display || paused) return;
    if (display.media.resource_type === "video") return;
    if (standalone) {
      setProgress(1);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setProgress(Math.min(1, elapsed / VIEW_MS));
      if (elapsed >= VIEW_MS) {
        window.clearInterval(timer);
        setIndex((i) => (i + 1 < order.length ? i + 1 : i));
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [display?.id, paused, order.length, display, standalone]);

  const go = useCallback(
    (delta: number) => {
      if (standalone) return;
      setIndex((i) => Math.min(Math.max(0, i + delta), order.length - 1));
    },
    [order.length, standalone],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, navigate]);

  const viewers = useStoryViewers(display?.id);
  const [viewersOpen, setViewersOpen] = useState(false);
  const own = user && display && user.id === display.author.id;

  if (feed.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading story">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (!display) {
    if (direct.isPending) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading story">
          <Spinner className="size-8" />
        </div>
      );
    }
    if (feed.isError) {
      return (
        <div className="flex flex-col items-center gap-3">
          <ErrorState title="Could not load stories" onRetry={() => { feed.refetch(); direct.refetch(); }} />
        </div>
      );
    }
    return (
      <EmptyState
        title="Story not available"
        message="It may have expired, been deleted, or you don't have access."
        action={
          <Button size="sm" onClick={() => navigate("/")}>
            Back to home
          </Button>
        }
      />
    );
  }

  const isVideo = display.media.resource_type === "video";
  const segmentCount = standalone ? 1 : order.length;
  const segmentPos = standalone ? 0 : index;

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        className="relative overflow-hidden rounded-2xl bg-ink-950 shadow-card select-none"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Progress segments */}
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
          {Array.from({ length: segmentCount }).map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded bg-surface/30">
              <div
                className="h-full bg-surface transition-[width]"
                style={{
                  width:
                    i < segmentPos ? "100%" : i === segmentPos ? `${progress * 100}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-3 top-6 z-10 flex items-center gap-2.5">
          <Avatar
            name={display.author.display_name || display.author.username}
            src={display.author.avatar_url}
            size="sm"
            className="border border-white/40 ring-0"
          />
          <Link
            to={`/u/${display.author.username}`}
            className="text-sm font-bold text-white drop-shadow hover:underline"
          >
            {display.author.username}
          </Link>
          <span className="text-xs text-white/70">{timeAgo(display.created_at)}</span>
          <span className="flex-1" />
          {own && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete story"
              className="cursor-pointer rounded-lg p-1.5 text-white/90 transition hover:bg-surface/20"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Close viewer"
            className="cursor-pointer rounded-lg p-1.5 text-white/90 transition hover:bg-surface/20"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* Media */}
        {isVideo ? (
          <video
            key={display.id}
            ref={videoRef}
            src={display.media.secure_url}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={() => go(1)}
            className="aspect-[9/16] max-h-[75vh] w-full object-contain"
            aria-label={display.caption ?? "Story video"}
          />
        ) : (
          <img
            key={display.id}
            src={display.media.secure_url}
            alt={display.caption ?? `Story by @${display.author.username}`}
            className="aspect-[9/16] max-h-[75vh] w-full object-cover"
            draggable={false}
          />
        )}

        {/* Tap zones (hidden for standalone deep links) */}
        {!standalone && (
          <>
            <button
              type="button"
              aria-label="Previous story"
              onClick={() => go(-1)}
              className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize"
            />
            <button
              type="button"
              aria-label="Next story"
              onClick={() => go(1)}
              className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize"
            />
            {index > 0 && (
              <ChevronLeft className="pointer-events-none absolute top-1/2 left-2 size-6 -translate-y-1/2 text-white/60" aria-hidden />
            )}
            {index < order.length - 1 && (
              <ChevronRight className="pointer-events-none absolute top-1/2 right-2 size-6 -translate-y-1/2 text-white/60" aria-hidden />
            )}
          </>
        )}

        {display.caption && (
          <p className="absolute inset-x-4 bottom-14 z-10 text-center text-sm whitespace-pre-line text-white drop-shadow">
            {display.caption}
          </p>
        )}

        {/* Viewer count (owner) */}
        {own && (
          <button
            type="button"
            onClick={() => setViewersOpen((v) => !v)}
            className="absolute bottom-4 left-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-full bg-ink-950/60 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Eye className="size-4" aria-hidden />
            Viewers
          </button>
        )}
      </div>

      {/* Viewer list */}
      {own && viewersOpen && (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <h2 className="text-sm font-bold text-1">Viewed by</h2>
          {viewers.isPending ? (
            <div className="flex justify-center py-4" role="status" aria-label="Loading viewers">
              <Spinner />
            </div>
          ) : viewers.isError ? (
            <p className="py-2 text-sm text-2">
              Couldn't load viewers.{" "}
              <button type="button" onClick={() => viewers.refetch()} className="cursor-pointer font-semibold text-primary">
                Retry
              </button>
            </p>
          ) : (viewers.data?.length ?? 0) === 0 ? (
            <p className="py-2 text-sm text-2">No views yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {viewers.data?.map((v) => (
                <li key={v.id}>
                  <Link
                    to={`/u/${v.username}`}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                  >
                    <Avatar name={v.display_name || v.username} src={v.avatar_url} size="sm" />
                    <span className="text-sm">
                      <span className="block font-bold text-1">{v.display_name}</span>
                      <span className="block text-2">@{v.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(display.id, { onSuccess: () => navigate("/") })
        }
        title="Delete this story?"
        description="It will disappear immediately."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
      <div className={cn("sr-only")} aria-live="polite">
        Story {segmentPos + 1} of {segmentCount}
      </div>
    </div>
  );
}
