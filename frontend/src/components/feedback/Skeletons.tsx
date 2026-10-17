import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

/** Title + optional trailing action, mirroring a page's header row. */
export function PageHeaderSkeleton({
  withAction = false,
  className,
}: {
  withAction?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <Skeleton className="h-8 w-36" />
      {withAction && <Skeleton className="h-9 w-28 rounded-xl" />}
    </div>
  );
}

/** The stories rail (avatar circles + captions). */
export function StoriesRailSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden py-1" aria-label="Loading stories">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/** A feed post: author row, media, action bar and caption. */
export function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A 3-column media grid (explore, tags, profile). */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

/** An avatar + two text lines, optionally with a trailing action. */
export function ListRowSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
      {withAction && <Skeleton className="h-9 w-24 rounded-xl" />}
    </div>
  );
}

export function ListRowsSkeleton({
  count = 3,
  withAction = false,
}: {
  count?: number;
  withAction?: boolean;
}) {
  return (
    <div className="space-y-2" aria-label="Loading list">
      {Array.from({ length: count }).map((_, i) => (
        <ListRowSkeleton key={i} withAction={withAction} />
      ))}
    </div>
  );
}

/** A single card containing avatar + two-line rows (user/tag lists). */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="rounded-2xl border border-line bg-surface p-2 shadow-card"
      aria-label="Loading list"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A full-height immersive (9:16) moment player, as on the Moments stage. */
export function ReelPlayerSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950 md:h-auto md:max-w-md md:max-h-[calc(100dvh_-_6rem)] md:aspect-[9/16] md:rounded-2xl">
      <Skeleton className="h-full w-full rounded-none bg-white/10 md:rounded-2xl" />
      <div className="absolute inset-x-3 top-3 flex items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-full bg-white/20" />
        <Skeleton className="h-4 w-24 bg-white/20" />
      </div>
      <div className="absolute inset-x-3 bottom-4 space-y-2">
        <Skeleton className="h-3 w-2/3 bg-white/20" />
        <Skeleton className="h-3 w-20 bg-white/20" />
      </div>
    </div>
  );
}

/** Conversation list rows inside the messages sidebar. */
export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="divide-y divide-line" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3.5">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Chat thread: alternating incoming/outgoing message bubbles. */
export function MessageThreadSkeleton() {
  const widths = ["w-40", "w-56", "w-32", "w-48", "w-24", "w-52"];
  return (
    <div
      className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-4"
      aria-label="Loading messages"
    >
      {widths.map((width, i) => (
        <div
          key={i}
          className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
        >
          <Skeleton className={cn("h-10 rounded-2xl", width)} />
        </div>
      ))}
    </div>
  );
}

/** Profile header card: avatar, name, bio and stats. */
export function ProfileHeaderSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="flex items-start gap-4">
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-t border-line pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
