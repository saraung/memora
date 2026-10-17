import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { CountItem } from "@/types/analytics";
import { colorAt } from "./palette";

export interface BarListProps {
  data: CountItem[];
  /** Humanize a raw key for the label column. */
  labelFor?: (key: string) => string;
  /** Stable color per row instead of a flat brand fill. */
  colorFor?: (key: string, index: number) => string;
  className?: string;
  emptyLabel?: string;
}

/** Ranked horizontal bars — best for category/role distributions. */
export function BarList({
  data,
  labelFor = (key) => key,
  colorFor,
  className = "",
  emptyLabel = "No data yet.",
}: BarListProps) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-3">{emptyLabel}</p>;
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((item, index) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const color = colorFor?.(item.key, index) ?? colorAt(index);
        return (
          <li key={item.key} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-1">
                {labelFor(item.key)}
              </span>
              <span className="shrink-0 tabular-nums text-3">
                {formatCompact(item.count)}
                <span className="ml-1.5 text-4">{pct}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(2, (item.count / max) * 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
