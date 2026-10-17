import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Flag, Heart, MessageCircle, MoreHorizontal, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { ReelComments } from "@/components/ephemeral/ReelComments";
import { useReport } from "@/components/moderation/ReportDialog";
import {
  useDeleteReel,
  useRecordReelView,
  useReelLike,
  useReelSave,
} from "@/features/ephemeral/hooks";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Reel } from "@/types/ephemeral";

/**
 * Immersive, full-bleed vertical (9:16) moment player — one per viewport,
 * Instagram/TikTok style. Controls float over the video.
 */
export function ReelPlayer({
  reel,
  active,
  onDeleted,
}: {
  reel: Reel;
  active: boolean;
  onDeleted?: () => void;
}) {
  const { user } = useAuth();
  const like = useReelLike(reel);
  const save = useReelSave(reel);
  const recordView = useRecordReelView();
  const remove = useDeleteReel();
  const { openReport } = useReport();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const countedRef = useRef(false);
  const own = user?.id === reel.author.id;

  // Autoplay the visible moment; record a qualified view on first play.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) {
      video?.pause();
      return;
    }
    video
      .play()
      .then(() => {
        if (!countedRef.current) {
          countedRef.current = true;
          recordView.mutate(reel.id);
        }
      })
      .catch(() => {
        /* autoplay blocked; user taps to play */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reel.id]);

  return (
    <article className="relative h-full w-full overflow-hidden bg-ink-950 shadow-card md:h-auto md:max-w-md md:max-h-[calc(100dvh_-_6rem)] md:aspect-[9/16] md:rounded-2xl">
      <video
        ref={videoRef}
        src={reel.video.secure_url}
        poster={reel.cover?.secure_url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-label={reel.caption ?? `Moment by @${reel.author.username}`}
        onClick={(e) => {
          const v = e.currentTarget;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Legibility scrims */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Top overlay: author + actions */}
      <div className="absolute inset-x-3 top-3 flex items-center gap-2.5">
        <Link to={`/u/${reel.author.username}`} className="shrink-0">
          <Avatar
            name={reel.author.display_name || reel.author.username}
            src={reel.author.avatar_url}
            size="sm"
            className="border border-white/40 ring-0"
          />
        </Link>
        <Link
          to={`/u/${reel.author.username}`}
          className="truncate text-sm font-bold text-white drop-shadow hover:underline"
        >
          {reel.author.username}
        </Link>
        <span className="text-xs text-white/70">{timeAgo(reel.created_at)}</span>
        <span className="flex-1" />
        <DropdownMenu
          label="Moment actions"
          trigger={
            <button
              type="button"
              aria-label="Moment actions"
              className="cursor-pointer rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          }
          align="right"
          items={
            own
              ? [
                  {
                    label: "Delete moment",
                    danger: true,
                    onSelect: () => setConfirmDelete(true),
                  },
                ]
              : [
                  {
                    label: "Report moment",
                    icon: <Flag className="size-4" aria-hidden />,
                    onSelect: () =>
                      openReport({
                        type: "reel",
                        id: reel.id,
                        label: `by @${reel.author.username}`,
                      }),
                  },
                ]
          }
        />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={!muted}
          className="cursor-pointer rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
        >
          {muted ? (
            <VolumeX className="size-4" aria-hidden />
          ) : (
            <Volume2 className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {/* Right action rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={() => like.mutate()}
          aria-pressed={reel.liked}
          aria-label={reel.liked ? "Unlike" : "Like"}
          className="flex cursor-pointer flex-col items-center gap-1"
        >
          <Heart
            className={cn(
              "size-8 drop-shadow",
              reel.liked ? "fill-red-500 text-red-500" : "text-white",
            )}
            aria-hidden
          />
          <span className="text-xs font-bold text-white drop-shadow">
            {reel.like_count}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-label="Comments"
          className="flex cursor-pointer flex-col items-center gap-1"
        >
          <MessageCircle className="size-8 text-white drop-shadow" aria-hidden />
          <span className="text-xs font-bold text-white drop-shadow">
            {reel.comment_count}
          </span>
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          aria-pressed={reel.saved}
          aria-label={reel.saved ? "Remove from saved" : "Save"}
          className="flex cursor-pointer flex-col items-center gap-1"
        >
          <Bookmark
            className={cn(
              "size-8 drop-shadow",
              reel.saved ? "fill-white text-white" : "text-white",
            )}
            aria-hidden
          />
          <span className="text-xs font-bold text-white drop-shadow">
            Save
          </span>
        </button>
      </div>

      {/* Caption + views */}
      <div className="absolute inset-x-3 bottom-4 pr-14">
        {reel.caption && (
          <p className="line-clamp-2 text-sm whitespace-pre-line text-white drop-shadow">
            {reel.caption}
          </p>
        )}
        <p className="mt-1 text-xs text-white/80">
          {reel.view_count} {reel.view_count === 1 ? "view" : "views"}
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          remove.mutate(reel.id, { onSuccess: () => onDeleted?.() });
          setConfirmDelete(false);
        }}
        title="Delete this moment?"
        description="The moment will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />

      {commentsOpen && (
        <ReelComments reel={reel} onClose={() => setCommentsOpen(false)} />
      )}
    </article>
  );
}
