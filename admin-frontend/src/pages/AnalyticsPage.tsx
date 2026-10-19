import { useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  MessageSquare,
  ShieldAlert,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, PageHeader } from "@/components/feedback/StateViews";
import {
  AreaChart,
  BarChart,
  BarList,
  ChartCard,
  DonutChart,
  STATUS_COLORS,
} from "@/components/charts";
import { useOverviewStats } from "@/features/analytics/hooks";
import { categoryLabel, roleLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CountItem } from "@/types/analytics";

const RANGES = [7, 14, 30, 90];

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const stats = useOverviewStats(days);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Growth, engagement, and moderation trends across the platform."
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
          title="Could not load analytics"
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Accounts"
              value={data?.accounts.total ?? 0}
              loading={stats.isPending}
              hint={data ? `${data.accounts.active} active` : undefined}
              icon={<Users className="size-5" />}
            />
            <StatCard
              label="New (30 days)"
              value={data?.accounts.new_30d ?? 0}
              loading={stats.isPending}
              icon={<UserPlus className="size-5" />}
              accentClass="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            />
            <StatCard
              label="Suspended"
              value={data?.accounts.suspended ?? 0}
              loading={stats.isPending}
              icon={<UserMinus className="size-5" />}
              accentClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            />
            <StatCard
              label="Reports (all time)"
              value={data?.reports.total ?? 0}
              loading={stats.isPending}
              hint={data ? `${data.reports.pending} pending` : undefined}
              icon={<ShieldAlert className="size-5" />}
            />
          </div>

          <ChartCard
            title="Signups over time"
            subtitle={`New accounts per day · last ${days} days`}
          >
            {stats.isPending ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <AreaChart
                data={data?.signups_series ?? []}
                height={240}
                unit="signups"
                ariaLabel="Signups over time"
              />
            )}
          </ChartCard>

          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <ChartCard
              title="Posts created"
              subtitle={`Published per day · last ${days} days`}
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

            <ChartCard
              title="Reports filed"
              subtitle={`Reports per day · last ${days} days`}
            >
              {stats.isPending ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <AreaChart
                  data={data?.reports_series ?? []}
                  color="#f59e0b"
                  unit="reports"
                  ariaLabel="Reports filed over time"
                />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <ChartCard title="Reports by reason" subtitle="All time">
              {stats.isPending ? (
                <Skeleton className="h-[240px] w-full" />
              ) : (
                <BarChart
                  data={data?.reports_by_category ?? []}
                  labelFor={categoryLabel}
                  ariaLabel="Reports by category"
                />
              )}
            </ChartCard>

            <ChartCard title="Moderation outcomes" subtitle="Report status">
              {stats.isPending ? (
                <Skeleton className="h-[200px] w-full" />
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

          <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
            <ChartCard title="Content mix" subtitle="All time">
              {stats.isPending ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <BarList
                  data={contentMix}
                  labelFor={(key) => key.charAt(0).toUpperCase() + key.slice(1)}
                />
              )}
            </ChartCard>

            <ChartCard title="Staff by role" subtitle="Assigned roles">
              {stats.isPending ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <DonutChart
                  data={data?.roles ?? []}
                  size={150}
                  centerLabel="Staff"
                  labelFor={roleLabel}
                />
              )}
            </ChartCard>

            <ChartCard title="Engagement" subtitle="Social graph & messaging">
              <dl className="space-y-4">
                <Metric
                  icon={<Users className="size-4" />}
                  label="Follows"
                  value={data?.social.follows ?? 0}
                />
                <Metric
                  icon={<MessageSquare className="size-4" />}
                  label="Messages"
                  value={data?.content.messages ?? 0}
                />
                <Metric
                  icon={<BarChart3 className="size-4" />}
                  label="Comments"
                  value={data?.content.comments ?? 0}
                />
                <Metric
                  icon={<ShieldAlert className="size-4" />}
                  label="Reports / account"
                  value={
                    data && data.accounts.total > 0
                      ? (data.reports.total / data.accounts.total).toFixed(2)
                      : "0"
                  }
                />
              </dl>
            </ChartCard>
          </div>

          {data && (
            <p className="text-xs text-4">
              Metrics computed {formatDateTime(data.generated_at)}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-sm text-2">
        <span className="text-primary" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="font-display text-lg font-bold text-1 tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
    </div>
  );
}
