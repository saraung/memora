import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { UserSummary } from "@/types/social";

export function UserListItem({ user }: { user: UserSummary }) {
  return (
    <Link
      to={`/u/${user.username}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
    >
      <Avatar name={user.display_name || user.username} src={user.avatar_url} />
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-bold text-1">
          <span className="truncate">{user.display_name}</span>
          {user.is_verified && (
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />
          )}
        </span>
        <span className="block truncate text-sm text-2">
          @{user.username}
        </span>
      </span>
    </Link>
  );
}
