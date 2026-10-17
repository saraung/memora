import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sparkline } from "@/components/charts/Sparkline";

export interface StatCardProps {
  label: string;
  value: number | string;
  loading?: boolean;
  hint?: string;
  icon?: ReactNode;
  /** Percentage change vs the previous period (optional). */
  delta?: number | null;
  sparkline?: number[];
  accentClass?: string;
}

export function StatCard({
  label,
  value,
  loading = false,
  hint,
  icon,
  delta,
  sparkline,
  accentClass,
}: StatCardProps) {
  const display =
    typeof value === "number" ? formatCompact(value) : value;
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-3 uppercase">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-16" />
          ) : (
            <p className="mt-2 text-3xl font-display font-extrabold text-1 tabular-nums">
              {display}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2">
            {hasDelta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-semibold",
                  delta! >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {delta! >= 0 ? (
                  <ArrowUpRight className="size-3.5" aria-hidden />
                ) : (
                  <ArrowDownRight className="size-3.5" aria-hidden />
                )}
                {Math.abs(delta!).toFixed(1)}%
              </span>
            )}
            {hint && <span className="truncate text-xs text-3">{hint}</span>}
          </div>
        </div>
        {icon && (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              accentClass ?? "bg-primary-soft text-primary",
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline values={sparkline} className="h-9 w-full" />
        </div>
      )}
    </div>
  );
}
