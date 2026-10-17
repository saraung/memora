import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, PageHeader } from "@/components/feedback/StateViews";
import {
  EMPTY_AUDIT_FILTERS,
  useAuditEvents,
  type AuditFilters,
} from "@/features/audit/hooks";
import { actionLabel, metaSummary, targetLabel } from "@/lib/labels";
import { formatDateTime, shortId } from "@/lib/format";

const TARGET_TYPES = [
  "user",
  "post",
  "comment",
  "story",
  "reel",
  "message",
  "report",
];

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const events = useAuditEvents(filters);
  const rows = events.data?.pages.flatMap((page) => page.items) ?? [];

  const update = (patch: Partial<AuditFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const hasFilters =
    filters.action !== "" ||
    filters.targetType !== "" ||
    filters.actorId !== "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Immutable trail of staff and moderation actions."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Action"
          placeholder="e.g. moderation.decide"
          value={filters.action}
          onChange={(event) => update({ action: event.target.value })}
        />
        <Select
          label="Target type"
          value={filters.targetType}
          onChange={(event) => update({ targetType: event.target.value })}
        >
          <option value="">Any target</option>
          {TARGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {targetLabel(type)}
            </option>
          ))}
        </Select>
        <Input
          label="Actor ID"
          placeholder="uuid…"
          value={filters.actorId}
          onChange={(event) => update({ actorId: event.target.value })}
        />
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            disabled={!hasFilters}
            onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
          >
            Clear filters
          </Button>
        </div>
      </div>

      {events.isError ? (
        <ErrorState title="Could not load audit events" onRetry={() => void events.refetch()} />
      ) : events.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6 text-primary" aria-hidden />}
          title="No matching events"
          message="Try widening or clearing the filters."
        />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>When</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Actor</TableHeaderCell>
                <TableHeaderCell>Target</TableHeaderCell>
                <TableHeaderCell>Details</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((event) => (
                <TableRow key={event.id} className="hover:bg-muted/40">
                  <TableCell className="whitespace-nowrap text-sm text-2">
                    {formatDateTime(event.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-1">
                      {actionLabel(event.action)}
                    </span>
                    <span className="block text-xs text-3">{event.action}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-2">
                    {event.actor_id ? shortId(event.actor_id) : "system"}
                  </TableCell>
                  <TableCell className="text-sm text-2">
                    {targetLabel(event.target_type)}
                    {event.target_id ? (
                      <span className="block font-mono text-xs text-3">
                        {shortId(event.target_id)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-3">
                    {metaSummary(event.meta) || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {events.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                loading={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
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
