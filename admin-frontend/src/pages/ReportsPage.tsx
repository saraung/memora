import { useState } from "react";
import { Link } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { EmptyState, ErrorState, PageHeader } from "@/components/feedback/StateViews";
import { useReports, type ReportFilters } from "@/features/reports/hooks";
import { shortId, timeAgo } from "@/lib/format";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type ReportCategory,
  type ReportStatus,
} from "@/types/moderation";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as ReportStatus[];
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as ReportCategory[];

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    status: "pending",
    category: "",
  });
  const reports = useReports(filters);
  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Review and action reports submitted by members."
      />

      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                status: e.target.value as ReportStatus | "",
              }))
            }
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                category: e.target.value as ReportCategory | "",
              }))
            }
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {reports.isPending ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3 shadow-card">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : reports.isError ? (
        <ErrorState
          title="Could not load reports"
          onRetry={() => void reports.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileWarning className="size-6 text-primary" aria-hidden />}
          title="No reports found"
          message="Nothing matches the current filters."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-muted/50 text-xs text-3 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Reporter</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Filed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((report) => (
                  <tr key={report.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-1">
                      {CATEGORY_LABELS[report.category]}
                    </td>
                    <td className="px-4 py-3 text-2">
                      {report.target_type}
                      <span className="text-4">
                        {" "}
                        · {shortId(report.target_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-2">
                      {report.reporter ? `@${report.reporter.username}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3 text-3">
                      {timeAgo(report.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/reports/${report.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reports.hasNextPage && (
            <div className="flex justify-center border-t border-line p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reports.fetchNextPage()}
                loading={reports.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
