import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  FileWarning,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, ErrorState, PageHeader } from "@/components/feedback/StateViews";
import {
  AreaChart,
  BarList,
  ChartCard,
  DonutChart,
  STATUS_COLORS,
} from "@/components/charts";
import { useOverviewStats } from "@/features/analytics/hooks";
import { useOverview } from "@/features/reports/hooks";
import { useHasPermission } from "@/features/auth/useAuth";
import { PERM } from "@/lib/permissions";
import { actionLabel, categoryLabel, roleLabel } from "@/lib/labels";
import { timeAgo, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountItem } from "@/types/analytics";

const RANGES = [7, 14, 30];

export function OverviewPage() {
  const [days, setDays] = useState(14);
  const stats = useOverviewStats(days);
  const canAudit = useHasPermission(PERM.AUDIT_READ);
  const { activity, pendingCount } = useOverview(canAudit);

  const data = stats.data;
  const contentMix: CountItem[] = data
    ? [
        { key: "posts", count: data.content.posts },
        { key: "reels", count: data.content.reels },
        { key: "stories", count: data.content.stories },
        { key: "comments", count: data.content.comments },
        { key: "messages", count: data.content.messages },
      ]
    : [];

  const activePct =
    data && data.accounts.total > 0
      ? Math.round((data.accounts.active / data.accounts.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Platform health, growth, and the moderation workload."
        actions={
          <div className="inline-flex overflow-hidden rounded-lg border border-line">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm font-semibold transition-colors",
                  days === range
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-2 hover:bg-muted",
                )}
              >
                {range}d
              </button>
            ))}
          </div>
        }
      />

      {stats.isError ? (
        <ErrorState
          title="Could not load metrics"
          message="The analytics service did not respond."
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total accounts"
              value={data?.accounts.total ?? 0}
              loading={stats.isPending}
              hint={data ? `+${data.accounts.new_7d} this week` : undefined}
              icon={<Users className="size-5" />}
              sparkline={data?.signups_series.map((p) => p.value)}
            />
            <StatCard
              label="Active accounts"
              value={data?.accounts.active ?? 0}
              loading={stats.isPending}
              hint={data ? `${activePct}% of all accounts` : undefined}
              icon={<Activity className="size-5" />}
              accentClass="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
            />
            <StatCard
              label="Pending reports"
              value={pendingCount}
              loading={stats.isPending}
              hint={
                data ? `${data.reports.last_7d} filed in last 7d` : undefined
              }
              icon={<ShieldAlert className="size-5" />}
              accentClass={
                pendingCount > 0
                  ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : undefined
              }
            />
            <StatCard
              label="Posts published"
              value={data?.content.posts ?? 0}
              loading={stats.isPending}
              hint={data ? `${data.content.reels} moments` : undefined}
              icon={<FileWarning className="size-5" />}
              sparkline={data?.posts_series.map((p) => p.value)}
            />
          </div>

          <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
            <ChartCard
              title="New signups"
              subtitle={`Accounts created in the last ${days} days`}
              className="lg:col-span-2"
            >
              {stats.isPending ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <AreaChart
                  data={data?.signups_series ?? []}
                  unit="signups"
                  ariaLabel="New signups over time"
                />
              )}
            </ChartCard>

            <ChartCard title="Reports by status" subtitle="Queue composition">
              {stats.isPending ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <DonutChart
                  data={data?.reports_by_status ?? []}
                  centerLabel="Reports"
                  colorFor={(key) => STATUS_COLORS[key] ?? "#94a3b8"}
                  labelFor={(key) => key.replace(/_/g, " ")}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <ChartCard
              title="Content created"
              subtitle={`Posts published in the last ${days} days`}
            >
              {stats.isPending ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <AreaChart
                  data={data?.posts_series ?? []}
                  color="#0ea5e9"
                  unit="posts"
                  ariaLabel="Posts created over time"
                />
              )}
            </ChartCard>

            <ChartCard title="Reports by reason" subtitle="All time">
              {stats.isPending ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <BarList
                  data={data?.reports_by_category ?? []}
                  labelFor={categoryLabel}
                  emptyLabel="No reports filed yet."
                />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <ChartCard title="Content mix" subtitle="Everything on the platform">
              {stats.isPending ? (
                <Skeleton className="h-[160px] w-full" />
              ) : (
                <BarList data={contentMix} labelFor={titleKey} />
              )}
            </ChartCard>

            <ChartCard title="Staff by role" subtitle="Assigned staff roles">
              {stats.isPending ? (
                <Skeleton className="h-[160px] w-full" />
              ) : (
                <BarList
                  data={data?.roles ?? []}
                  labelFor={roleLabel}
                  emptyLabel="No staff roles assigned."
                />
              )}
            </ChartCard>
          </div>

          {canAudit && (
          <section className="rounded-xl border border-line bg-surface shadow-card">
            <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-3" aria-hidden />
                <h2 className="text-sm font-bold text-1">
                  Recent admin activity
                </h2>
                {activity.isFetching && <Spinner className="size-4" />}
              </div>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Review reports <ArrowRight className="size-4" aria-hidden />
              </Link>
            </header>
            {activity.isPending ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activity.isError ? (
              <div className="p-5">
                <ErrorState
                  title="Could not load activity"
                  onRetry={() => void activity.refetch()}
                />
              </div>
            ) : activity.data.items.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<ShieldAlert className="size-6 text-primary" aria-hidden />}
                  title="No admin activity yet"
                  message="Moderation and staff actions will appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {activity.data.items.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-1">
                        {actionLabel(event.action)}
                      </p>
                      <p className="truncate text-xs text-3">
                        {event.action}
                        {event.target_id ? ` · ${shortId(event.target_id)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-3">
                      {timeAgo(event.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}
        </>
      )}
    </div>
  );
}

function titleKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
