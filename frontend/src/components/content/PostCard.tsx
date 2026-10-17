import { Link } from "react-router-dom";
import { Bookmark, Heart, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useBookmark, useLike } from "@/features/content/hooks";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Post } from "@/types/content";
import { PostCarousel } from "@/components/content/PostCarousel";
import { RichText } from "@/components/content/RichText";

export function PostCard({ post }: { post: Post }) {
  const like = useLike(post);
  const bookmark = useBookmark(post);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to={`/u/${post.author.username}`} aria-label={`@${post.author.username}`}>
          <Avatar
            name={post.author.display_name || post.author.username}
            src={post.author.avatar_url}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/u/${post.author.username}`}
            className="block truncate text-sm font-bold text-1 hover:underline"
          >
            {post.author.username}
          </Link>
          <p className="text-xs text-3">{timeAgo(post.created_at)}</p>
        </div>
      </header>

      <PostCarousel media={post.media} />

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => like.mutate()}
            aria-pressed={post.liked}
            aria-label={post.liked ? "Unlike" : "Like"}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
          >
            <Heart
              className={cn(
                "size-6 transition-colors",
                post.liked ? "fill-red-500 text-red-500" : "text-2",
              )}
              aria-hidden
            />
          </button>
          <Link
            to={`/p/${post.id}`}
            aria-label={`${post.comment_count} comments`}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
          >
            <MessageCircle className="size-6 text-2" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => bookmark.mutate()}
            aria-pressed={post.bookmarked}
            aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark"}
            className="ml-auto cursor-pointer rounded-lg p-2 transition-colors hover:bg-muted"
          >
            <Bookmark
              className={cn(
                "size-6 transition-colors",
                post.bookmarked
                  ? "fill-memora-600 text-primary"
                  : "text-2",
              )}
              aria-hidden
            />
          </button>
        </div>

        {post.like_count > 0 && (
          <p className="mt-1 text-sm font-bold text-1">
            {post.like_count} {post.like_count === 1 ? "like" : "likes"}
          </p>
        )}

        {post.caption && (
          <p className="mt-1 text-sm text-1">
            <Link
              to={`/u/${post.author.username}`}
              className="mr-2 font-bold text-1 hover:underline"
            >
              {post.author.username}
            </Link>
            <RichText text={post.caption} className="whitespace-pre-line" />
          </p>
        )}

        {post.comment_count > 0 && (
          <Link
            to={`/p/${post.id}`}
            className="mt-1.5 block text-sm text-3 hover:text-2"
          >
            View all {post.comment_count}{" "}
            {post.comment_count === 1 ? "comment" : "comments"}
          </Link>
        )}
      </div>
    </article>
  );
}
