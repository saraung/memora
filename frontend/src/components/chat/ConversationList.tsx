import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, MoreHorizontal, Search, SquarePen, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Spinner } from "@/components/ui/Spinner";
import { NewChatSheet } from "@/components/chat/NewChatSheet";
import { ConversationListSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { useConversations, useDeleteConversation } from "@/features/chat/hooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationPreview } from "@/types/chat";

function previewText(body: string | null, deleted: boolean): string {
  if (deleted) return "Message deleted";
  if (!body) return "📷 Photo";
  return body;
}

/** Online if seen within the last 5 minutes. */
function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  const now = Date.now();
  return now - seen < 5 * 60 * 1000;
}

function matches(conv: ConversationPreview, query: string): boolean {
  const q = query.toLowerCase();
  const user = conv.other_user;
  return (
    user.username.toLowerCase().includes(q) ||
    (user.display_name ?? "").toLowerCase().includes(q) ||
    (conv.last_message?.body ?? "").toLowerCase().includes(q)
  );
}

export function ConversationList() {
  const conversations = useConversations();
  const remove = useDeleteConversation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinelRef = useInfiniteScroll(
    () => conversations.fetchNextPage(),
    Boolean(conversations.hasNextPage) && !conversations.isFetchingNextPage,
  );

  const items = useMemo(
    () => conversations.data?.pages.flatMap((p) => p.items) ?? [],
    [conversations.data],
  );
  const filtered = useMemo(
    () => (query.trim() ? items.filter((c) => matches(c, query.trim())) : items),
    [items, query],
  );

  let body: React.ReactNode;
  if (conversations.isPending) {
    body = <ConversationListSkeleton />;
  } else if (conversations.isError) {
    body = (
      <div className="p-4">
        <ErrorState
          title="Could not load conversations"
          onRetry={() => conversations.refetch()}
        />
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="p-4">
        <EmptyState
          title="No conversations yet"
          message="Start one from someone's profile."
          icon={<MessageCircle className="size-6 text-primary" aria-hidden />}
        />
      </div>
    );
  } else if (filtered.length === 0) {
    body = (
      <p className="p-6 text-center text-sm text-3">
        No conversations match “{query.trim()}”.
      </p>
    );
  } else {
    body = (
      <ul className="divide-y divide-line">
        {filtered.map((conv) => (
          <li
            key={conv.id}
            className="group flex items-center gap-1 pr-1"
          >
            <Link
              to={`/messages/${conv.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3.5 transition-colors hover:bg-muted"
            >
              <div className="relative shrink-0">
                <Avatar
                  name={
                    conv.other_user.display_name || conv.other_user.username
                  }
                  src={conv.other_user.avatar_url}
                  size="lg"
                  className="size-12"
                />
                {isOnline(conv.other_user.last_seen_at) && (
                  <span
                    aria-label="Online"
                    className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface bg-green-500 shadow-sm"
                  />
                )}
                {conv.unread_count > 0 && (
                  <span
                    aria-label={`${conv.unread_count} unread`}
                    className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary"
                  >
                    {conv.unread_count > 9 ? "9+" : conv.unread_count}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-[15px] text-1",
                      conv.unread_count > 0 ? "font-black" : "font-bold",
                    )}
                  >
                    {conv.other_user.display_name || conv.other_user.username}
                  </span>
                  {conv.last_message && (
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        conv.unread_count > 0
                          ? "font-semibold text-primary"
                          : "text-3",
                      )}
                    >
                      {timeAgo(conv.last_message.created_at)}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "truncate text-sm",
                    conv.unread_count > 0
                      ? "font-semibold text-1"
                      : "text-3",
                  )}
                >
                  {previewText(
                    conv.last_message?.body ?? null,
                    conv.last_message?.is_deleted ?? false,
                  )}
                </p>
              </div>
            </Link>
            <DropdownMenu
              label={`Options for conversation with @${conv.other_user.username}`}
              trigger={
                <button
                  type="button"
                  aria-label={`Options for conversation with @${conv.other_user.username}`}
                  className="cursor-pointer rounded-lg p-2 text-3 opacity-100 transition group-hover:opacity-100 hover:bg-muted hover:text-2 focus-visible:opacity-100 md:opacity-0"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </button>
              }
              items={[
                {
                  label: "Delete conversation",
                  icon: <Trash2 className="size-4" aria-hidden />,
                  danger: true,
                  onSelect: () => setDeletingId(conv.id),
                },
              ]}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 shrink-0 border-b border-line bg-surface/95 px-3 pt-3 pb-2.5 backdrop-blur">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h1 className="text-xl font-display font-extrabold tracking-tight text-1">
            Chats
          </h1>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="New chat"
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary/15"
          >
            <SquarePen className="size-4" aria-hidden />
            New
          </button>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-3"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-10 w-full rounded-xl border border-line bg-muted/60 pr-9 pl-9 text-sm text-1 placeholder:text-3 focus:border-primary focus:bg-surface"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-full p-1 text-3 hover:bg-muted hover:text-2"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {body}
        {conversations.hasNextPage && (
          <div ref={sentinelRef} className="flex justify-center p-3">
            <Spinner />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) remove.mutate(deletingId);
          setDeletingId(null);
        }}
        title="Delete this conversation?"
        description="It will disappear from your list. The other person keeps their copy."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />

      <NewChatSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
