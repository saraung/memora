import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, PageHeader } from "@/components/feedback/StateViews";
import { useUserSearch } from "@/features/users/hooks";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/labels";

export function UsersPage() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const search = useUserSearch(deferred);

  const users = search.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Look up accounts, review their standing, and manage roles."
      />

      <div className="max-w-md">
        <Input
          type="search"
          placeholder="Search by name, username, or email…"
          aria-label="Search users"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </div>

      {deferred.length < 1 ? (
        <EmptyState
          icon={<Search className="size-6 text-primary" aria-hidden />}
          title="Find an account"
          message="Start typing a name, @username, or email address to search the directory."
        />
      ) : search.isError ? (
        <ErrorState
          title="Search failed"
          onRetry={() => void search.refetch()}
        />
      ) : search.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-6 text-primary" aria-hidden />}
          title="No accounts found"
          message={`No users match “${deferred}”.`}
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Account</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Roles</TableHeaderCell>
                <TableHeaderCell>Joined</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.display_name} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-1">
                          {user.display_name}
                        </p>
                        <p className="truncate text-xs text-3">
                          @{user.username} · {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={user.account_status} />
                  </TableCell>
                  <TableCell>
                    {user.roles.length === 0 ? (
                      <span className="text-xs text-3">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="brand">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-2">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/users/${user.id}`}
                      className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-1 transition-colors hover:border-line-strong hover:bg-muted"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {search.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                loading={search.isFetchingNextPage}
                onClick={() => void search.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
