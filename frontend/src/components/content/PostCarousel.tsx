import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostMedia } from "@/types/content";

function MediaItem({ media }: { media: PostMedia }) {
  if (media.resource_type === "video") {
    return (
      <video
        src={media.secure_url}
        controls
        playsInline
        preload="metadata"
        aria-label={media.alt_text ?? "Video"}
        className="aspect-square w-full bg-ink-950 object-contain"
      />
    );
  }
  return (
    <img
      src={media.secure_url}
      alt={media.alt_text ?? "Post image"}
      loading="lazy"
      className="aspect-square w-full bg-muted object-cover"
    />
  );
}

export function PostCarousel({ media }: { media: PostMedia[] }) {
  const [index, setIndex] = useState(0);
  if (media.length === 0) return null;

  const go = (delta: number) =>
    setIndex((i) => (i + delta + media.length) % media.length);

  return (
    <div className="group/carousel relative overflow-hidden bg-muted">
      <div
        className="flex transition-transform duration-300"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {media.map((item) => (
          <div key={item.id} className="w-full shrink-0">
            <MediaItem media={item} />
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute top-1/2 left-3 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface/90 shadow-card transition group-hover/carousel:flex"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute top-1/2 right-3 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface/90 shadow-card transition group-hover/carousel:flex"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {media.map((item, i) => (
              <span
                key={item.id}
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === index ? "bg-surface" : "bg-surface/50",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
