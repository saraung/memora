import { Link } from "react-router-dom";
import type { Post } from "@/types/content";

export function PostTile({ post }: { post: Post }) {
  const first = post.media[0];
  return (
    <Link
      to={`/p/${post.id}`}
      aria-label={`Post by @${post.author.username}`}
      className="group relative block aspect-square overflow-hidden rounded-xl bg-muted"
    >
      {first?.resource_type === "video" ? (
        <video
          src={first.secure_url}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      ) : first ? (
        <img
          src={first.secure_url}
          alt={first.alt_text ?? `Post by @${post.author.username}`}
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      ) : null}
      {post.media.length > 1 && (
        <span
          aria-label={`${post.media.length} items`}
          className="absolute top-2 right-2 rounded-md bg-ink-950/60 px-1.5 py-0.5 text-[11px] font-bold text-white"
        >
          {post.media.length}
        </span>
      )}
    </Link>
  );
}
