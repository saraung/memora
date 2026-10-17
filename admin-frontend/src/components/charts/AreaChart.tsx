import { useId, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { formatCompact, formatDay } from "@/lib/format";
import type { SeriesPoint } from "@/types/analytics";
import { BRAND } from "./palette";
import { useElementWidth } from "./useElementWidth";

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export interface AreaChartProps {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  unit?: string;
  className?: string;
  /** Label read by screen readers, e.g. "New signups". */
  ariaLabel?: string;
}

/** Responsive single-series area chart with hover readout. */
export function AreaChart({
  data,
  color = BRAND,
  height = 220,
  unit = "",
  className,
  ariaLabel = "Time series",
}: AreaChartProps) {
  const gradientId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const pad = { top: 14, right: 12, bottom: 24, left: 40 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);
  const values = data.map((point) => point.value);
  const max = niceCeil(Math.max(1, ...values));
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const x = (index: number) => pad.left + index * step;
  const y = (value: number) => pad.top + innerH * (1 - value / max);
  const baseline = pad.top + innerH;

  const linePath = data
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`)
    .join(" ");
  const areaPath =
    data.length > 0
      ? `${linePath} L${x(data.length - 1)},${baseline} L${x(0)},${baseline} Z`
      : "";

  const gridValues = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const index = Math.round((localX - pad.left) / step);
    setActive(Math.min(data.length - 1, Math.max(0, index)));
  };

  const activePoint = active !== null ? data[active] : null;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={handleMove}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {gridValues.map((fraction) => {
            const gy = y(max * fraction);
            return (
              <g key={fraction}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={gy}
                  y2={gy}
                  className="stroke-line"
                  strokeWidth={1}
                  strokeDasharray={fraction === 0 ? undefined : "3 4"}
                />
                <text
                  x={pad.left - 8}
                  y={gy + 3}
                  textAnchor="end"
                  className="fill-[color:var(--m-tx-4)] text-[10px]"
                >
                  {formatCompact(Math.round(max * fraction))}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {data.map((point, index) =>
            index % labelEvery === 0 || index === data.length - 1 ? (
              <text
                key={point.date}
                x={x(index)}
                y={height - 6}
                textAnchor="middle"
                className="fill-[color:var(--m-tx-4)] text-[10px]"
              >
                {formatDay(point.date)}
              </text>
            ) : null,
          )}

          {activePoint && active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={pad.top}
                y2={baseline}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={x(active)}
                cy={y(activePoint.value)}
                r={4}
                fill={color}
                stroke="var(--m-bg-surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      )}

      {activePoint && active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-xs shadow-pop"
          style={{ left: x(active), top: y(activePoint.value) - 8 }}
        >
          <p className="font-semibold text-1">
            {activePoint.value}
            {unit ? ` ${unit}` : ""}
          </p>
          <p className="text-3">{formatDay(activePoint.date)}</p>
        </div>
      )}

      {data.length === 0 && (
        <p className="py-10 text-center text-sm text-3">No data in range.</p>
      )}
    </div>
  );
}
