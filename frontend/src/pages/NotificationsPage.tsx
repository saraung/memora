import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Flag,
  Heart,
  MessageCircle,
  PhoneCall,
  Send,
  ShieldAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeaderSkeleton } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/chat";

const ICONS: Record<string, LucideIcon> = {
  follow: UserPlus,
  follow_request: UserPlus,
  like: Heart,
  comment: MessageCircle,
  mention: MessageCircle,
  message: Send,
  call: PhoneCall,
  moderation: Flag,
  security: ShieldAlert,
};

interface NotificationGroup {
  key: string;
  items: NotificationItem[];
}

/**
 * Collapse notifications that describe the same event target the way real
 * apps do — "Alice and 3 others liked your post" instead of one row each.
 * Follows and system notices stay individual.
 */
function groupKey(item: NotificationItem): string | null {
  switch (item.type) {
    case "like":
    case "comment":
    case "mention":
      return item.target_id
        ? `${item.type}:${item.target_type ?? "post"}:${item.target_id}`
        : null;
    case "message":
    case "call":
      return item.target_id ? `${item.type}:${item.target_id}` : null;
    default:
      return null;
  }
}

function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  const order: string[] = [];
  for (const item of items) {
    const key = groupKey(item) ?? `single:${item.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, items: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.items.push(item);
  }
  return order.map((key) => groups.get(key)!);
}

function targetLink(group: NotificationGroup): string | null {
  const item = group.items[0];
  switch (item.type) {
    case "follow":
    case "follow_request":
      return item.actor ? `/u/${item.actor.username}` : null;
    case "like":
    case "comment":
    case "mention":
      if (item.target_type === "reel") {
        return item.target_id ? `/reels/${item.target_id}` : null;
      }
      return item.target_id ? `/p/${item.target_id}` : null;
    case "message":
    case "call":
      return item.target_id ? `/messages/${item.target_id}` : null;
    default:
      return null;
  }
}

/** Human sentence for a group; `subject` is the leading actor's name. */
function describe(group: NotificationGroup): string {
  const item = group.items[0];
  const subject = item.actor
    ? item.actor.display_name || item.actor.username
    : "Someone";
  const count = group.items.length;
  const others = count - 1;
  const noun = item.target_type === "reel" ? "moment" : "post";
  const many = (single: string, plural: string) =>
    count === 1 ? single : plural;

  switch (item.type) {
    case "follow":
      return `${subject} started following you`;
    case "follow_request":
      return `${subject} requested to follow you`;
    case "like":
      return others > 0
        ? `${subject} and ${others} ${others === 1 ? "other" : "others"} liked your ${noun}`
        : `${subject} liked your ${noun}`;
    case "comment":
      return others > 0
        ? `${subject} and ${others} ${others === 1 ? "other" : "others"} commented on your ${noun}`
        : `${subject} commented on your ${noun}`;
    case "mention":
      return others > 0
        ? `${subject} and ${others} ${others === 1 ? "other" : "others"} mentioned you`
        : `${subject} mentioned you in a ${noun}`;
    case "message":
      return many(
        `${subject} sent you a message`,
        `${subject} sent you ${count} messages`,
      );
    case "call":
      return many(`${subject} called you`, `${subject} called you ${count} times`);
    case "moderation":
      return "Update about a moderation decision";
    case "security":
      return "Security update for your account";
    default:
      return `${subject} interacted with you`;
  }
}

function NotificationRow({ group }: { group: NotificationGroup }) {
  const markRead = useMarkNotificationRead();
  const lead = group.items[0];
  const unread = group.items.filter((i) => !i.is_read);
  const Icon = ICONS[lead.type] ?? Bell;
  const link = targetLink(group);
  const actorName = lead.actor
    ? lead.actor.display_name || lead.actor.username
    : "Memora";
  const others = group.items.length - 1;

  const inner = (
    <>
      <span className="relative shrink-0">
        {lead.actor ? (
          <Avatar name={actorName} src={lead.actor.avatar_url} />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
            <Icon className="size-5 text-primary" aria-hidden />
          </span>
        )}
        {others > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-surface bg-ink-900 text-[10px] font-bold text-white dark:bg-muted dark:text-1"
          >
            +{others > 9 ? "9" : others}
          </span>
        )}
        {unread.length > 0 && (
          <span
            aria-label="Unread"
            className="absolute top-0 right-0 size-2.5 rounded-full border-2 border-surface bg-primary"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-1">{describe(group)}</span>
        <span className="block text-xs text-3">
          {timeAgo(lead.created_at)}
        </span>
      </span>
      {unread.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            unread.forEach((item) => markRead.mutate(item.id));
          }}
          aria-label="Mark as read"
          title="Mark as read"
          className="shrink-0 cursor-pointer rounded-lg p-1.5 text-3 transition-colors hover:bg-muted hover:text-primary"
        >
          <CheckCheck className="size-4" aria-hidden />
        </button>
      )}
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted",
    unread.length > 0 && "bg-primary-soft/50 hover:bg-primary-soft",
  );

  return (
    <li>
      {link ? (
        <Link to={link} className={classes}>
          {inner}
        </Link>
      ) : (
        <div className={classes}>{inner}</div>
      )}
    </li>
  );
}

export function NotificationsPage() {
  const notifications = useNotifications();
  const markAll = useMarkAllNotificationsRead();

  if (notifications.isPending) {
    return (
      <PageContainer className="space-y-4">
        <PageHeaderSkeleton withAction />
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (notifications.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load notifications"
          onRetry={() => notifications.refetch()}
        />
      </PageContainer>
    );
  }

  const items = notifications.data.pages.flatMap((p) => p.items);
  const groups = groupNotifications(items);
  const hasUnread = items.some((n) => !n.is_read);

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
          Notifications
        </h1>
        {hasUnread && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>
      {groups.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          message="Follows, likes, comments, mentions and messages will show up here."
          icon={<Bell className="size-6 text-primary" aria-hidden />}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
          <ul className="divide-y divide-line">
            {groups.map((group) => (
              <NotificationRow key={group.key} group={group} />
            ))}
          </ul>
          {notifications.hasNextPage && (
            <div className="flex justify-center p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => notifications.fetchNextPage()}
                loading={notifications.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          )}
          {notifications.isFetching && !notifications.isFetchingNextPage && (
            <div className="flex justify-center p-3">
              <Spinner />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
