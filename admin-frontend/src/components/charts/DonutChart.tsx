import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { CountItem } from "@/types/analytics";
import { CHART_COLORS, colorAt } from "./palette";

export interface DonutChartProps {
  data: CountItem[];
  size?: number;
  thickness?: number;
  labelFor?: (key: string) => string;
  colorFor?: (key: string, index: number) => string;
  centerLabel?: string;
  className?: string;
}

/** Donut with an inline legend — best for status/share breakdowns. */
export function DonutChart({
  data,
  size = 168,
  thickness = 18,
  labelFor = (key) => key,
  colorFor,
  centerLabel = "Total",
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const fractionOf = (item: CountItem) =>
    total > 0 ? item.count / total : 0;

  const segments = data.map((item, index) => {
    const dash = fractionOf(item) * circumference;
    const before = data
      .slice(0, index)
      .reduce((sum, prev) => sum + fractionOf(prev), 0);
    return {
      item,
      index,
      dash,
      offset: -before * circumference,
      color: colorFor?.(item.key, index) ?? colorAt(index),
      pct: Math.round(fractionOf(item) * 100),
    };
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={centerLabel}>
          <g transform={`rotate(-90 ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--m-bg-muted)"
              strokeWidth={thickness}
            />
            {total > 0 &&
              segments.map((segment) => (
                <circle
                  key={segment.item.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                  strokeDashoffset={segment.offset}
                />
              ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-display font-extrabold text-1">
            {formatCompact(total)}
          </span>
          <span className="text-xs text-3">{centerLabel}</span>
        </div>
      </div>

      <ul className="min-w-[8rem] flex-1 space-y-2">
        {segments.length === 0 && (
          <li className="text-sm text-3">No data yet.</li>
        )}
        {segments.map((segment) => (
          <li
            key={segment.item.key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden
              />
              <span className="truncate text-1">
                {labelFor(segment.item.key)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-3">
              {formatCompact(segment.item.count)}
              <span className="ml-1.5 text-4">{segment.pct}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CHART_COLORS };
