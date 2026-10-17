import { useState } from "react";
import { Link } from "react-router-dom";
import { CornerDownRight, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/StateViews";
import { RichText } from "@/components/content/RichText";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
} from "@/features/content/hooks";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { threadComments } from "@/lib/comments";
import type { CommentItem, Post } from "@/types/content";

function CommentRow({
  post,
  comment,
  nested,
  onReply,
}: {
  post: Post;
  comment: CommentItem;
  nested?: boolean;
  onReply: (comment: CommentItem) => void;
}) {
  const { user } = useAuth();
  const remove = useDeleteComment(post.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canDelete =
    user &&
    (user.id === comment.author.id || user.id === post.author.id);

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

function CommentComposer({
  postId,
  replyTo,
  onCancelReply,
}: {
  postId: string;
  replyTo: CommentItem | null;
  onCancelReply: () => void;
}) {
  const create = useCreateComment(postId);
  const [body, setBody] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    create.mutate(
      { body: text, parentId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setBody("");
          onCancelReply();
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="border-t border-line px-4 py-3"
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
            onClick={onCancelReply}
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
  );
}

function CommentList({
  post,
  onReply,
}: {
  post: Post;
  onReply: (comment: CommentItem) => void;
}) {
  const comments = useComments(post.id);

  if (comments.isPending) {
    return (
      <div className="flex justify-center py-6" role="status" aria-label="Loading comments">
        <Spinner />
      </div>
    );
  }

  if (comments.isError) {
    return (
      <ErrorState
        title="Could not load comments"
        onRetry={() => comments.refetch()}
      />
    );
  }

  const items = comments.data.pages.flatMap((page) => page.items);
  const threads = threadComments(items);

  return (
    <div className="px-4">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-3">
          No comments yet. Be the first to reply.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id}>
              <ul className="divide-y divide-line">
                <CommentRow post={post} comment={comment} onReply={onReply} />
                {replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    post={post}
                    comment={reply}
                    nested
                    onReply={onReply}
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
  );
}

/** Comment list + composer that share reply state. */
export function CommentSection({ post }: { post: Post }) {
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <CommentList post={post} onReply={setReplyTo} />
      <CommentComposer
        postId={post.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </section>
  );
}
