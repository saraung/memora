import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/feedback/StateViews";
import { useUserSearch } from "@/features/search/hooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

/** Compose picker: search people and open a fresh (unsent) DM thread. */
export function NewChatSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const results = useUserSearch(query);
  const sentinelRef = useInfiniteScroll(
    () => results.fetchNextPage(),
    Boolean(results.hasNextPage) && !results.isFetchingNextPage,
  );

  const users = results.data?.pages.flatMap((p) => p.items) ?? [];
  const trimmed = query.trim();

  const choose = (username: string) => {
    onClose();
    setQuery("");
    navigate(`/messages/new/${username}`);
  };

  return (
    <Dialog open={open} onClose={onClose} title="New chat">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-3"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          autoFocus
          placeholder="Search people"
          aria-label="Search people"
          className="h-10 w-full rounded-xl border border-line bg-muted/60 pr-3 pl-9 text-sm text-1 placeholder:text-3 focus:border-primary focus:bg-surface"
        />
      </div>

      <div className="mt-3 max-h-[50vh] min-h-[8rem] overflow-y-auto">
        {!trimmed ? (
          <p className="py-10 text-center text-sm text-3">
            Search for someone to start a conversation.
          </p>
        ) : results.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : results.isError ? (
          <ErrorState
            title="Could not search"
            onRetry={() => results.refetch()}
          />
        ) : users.length === 0 ? (
          <EmptyState
            title="No people found"
            message={`No results for “${trimmed}”.`}
            icon={<UserPlus className="size-6 text-primary" aria-hidden />}
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => choose(user.username)}
                    className="flex w-full cursor-pointer items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <Avatar
                      name={user.display_name || user.username}
                      src={user.avatar_url}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-1">
                        {user.display_name || user.username}
                      </p>
                      <p className="truncate text-xs text-3">
                        @{user.username}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {results.hasNextPage && (
              <div ref={sentinelRef} className="flex justify-center p-3">
                <Spinner />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
