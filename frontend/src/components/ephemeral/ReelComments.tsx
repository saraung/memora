import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CornerDownRight, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/StateViews";
import { RichText } from "@/components/content/RichText";
import {
  useCreateReelComment,
  useDeleteReelComment,
  useReelComments,
} from "@/features/ephemeral/hooks";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { threadComments } from "@/lib/comments";
import type { Reel, ReelComment } from "@/types/ephemeral";

function CommentRow({
  reel,
  comment,
  nested,
  onReply,
}: {
  reel: Reel;
  comment: ReelComment;
  nested?: boolean;
  onReply: (comment: ReelComment) => void;
}) {
  const { user } = useAuth();
  const remove = useDeleteReelComment(reel.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canDelete =
    user &&
    (user.id === comment.author.id || user.id === reel.author.id);

  return (
    <li className={cn("flex gap-3 py-3", nested && "pl-11")}>
      <Link to={`/u/${comment.author.username}`} className="shrink-0">
        <Avatar
          name={comment.author.display_name || comment.author.username}
          src={comment.author.avatar_url}
          size="sm"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link
            to={`/u/${comment.author.username}`}
            className="mr-2 font-bold text-1 hover:underline"
          >
            {comment.author.username}
          </Link>
          <RichText text={comment.body} className="whitespace-pre-line text-1" />
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-3">
          <span>{timeAgo(comment.created_at)}</span>
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="flex cursor-pointer items-center gap-1 font-semibold transition-colors hover:text-2"
          >
            <CornerDownRight className="size-3.5" aria-hidden />
            Reply
          </button>
        </div>
      </div>
      {canDelete && (
        <>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label="Delete comment"
            className="h-fit cursor-pointer rounded-lg p-1.5 text-3 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              remove.mutate(comment.id);
              setConfirmOpen(false);
            }}
            title="Delete comment?"
            description="This can't be undone."
            confirmLabel="Delete"
            danger
            loading={remove.isPending}
          />
        </>
      )}
    </li>
  );
}

export function ReelComments({
  reel,
  onClose,
}: {
  reel: Reel;
  onClose: () => void;
}) {
  const comments = useReelComments(reel.id);
  const create = useCreateReelComment(reel);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    create.mutate(
      { body: text, parentId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setBody("");
          setReplyTo(null);
        },
      },
    );
  };

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const threads = threadComments(items);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
      className="absolute inset-0 z-40 flex flex-col justify-end bg-black/50 pb-[calc(3rem+env(safe-area-inset-bottom))] md:pb-0"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80%] flex-col overflow-hidden rounded-t-2xl bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-1">
            Comments{reel.comment_count > 0 ? ` · ${reel.comment_count}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="cursor-pointer rounded-lg p-1.5 text-3 transition-colors hover:bg-muted hover:text-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {comments.isPending ? (
            <div
              className="flex justify-center py-6"
              role="status"
              aria-label="Loading comments"
            >
              <Spinner />
            </div>
          ) : comments.isError ? (
            <ErrorState
              title="Could not load comments"
              onRetry={() => comments.refetch()}
            />
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-3">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {threads.map(({ comment, replies }) => (
                <li key={comment.id}>
                  <ul className="divide-y divide-line">
                    <CommentRow
                      reel={reel}
                      comment={comment}
                      onReply={setReplyTo}
                    />
                    {replies.map((reply) => (
                      <CommentRow
                        key={reply.id}
                        reel={reel}
                        comment={reply}
                        nested
                        onReply={setReplyTo}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {comments.hasNextPage && (
            <div className="flex justify-center py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => comments.fetchNextPage()}
                loading={comments.isFetchingNextPage}
              >
                Load more comments
              </Button>
            </div>
          )}
        </div>

        <form
          onSubmit={submit}
          className="shrink-0 border-t border-line px-3 py-3"
        >
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs text-2">
              <span className="truncate">
                Replying to{" "}
                <span className="font-semibold text-1">
                  @{replyTo.author.username}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                className="cursor-pointer rounded p-0.5 text-3 transition-colors hover:text-1"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
              aria-label={replyTo ? "Write a reply" : "Add a comment"}
              maxLength={1000}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-1 placeholder:text-3 focus:border-primary"
            />
            <Button
              type="submit"
              size="sm"
              loading={create.isPending}
              disabled={!body.trim()}
            >
              Post
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
