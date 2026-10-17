import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/features/notifications/hooks";

/** Bell with unread badge; polls quietly in the background. */
export function NotificationBell() {
  const { data: unread = 0 } = useUnreadCount();
  return (
    <Link
      to="/notifications"
      aria-label={
        unread > 0
          ? `Notifications, ${unread} unread`
          : "Notifications"
      }
      className="relative rounded-lg p-2 text-2 transition-colors hover:bg-muted hover:text-1"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
