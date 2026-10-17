import { useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { CountItem } from "@/types/analytics";
import { BRAND } from "./palette";
import { useElementWidth } from "./useElementWidth";

export interface BarChartProps {
  data: CountItem[];
  color?: string;
  height?: number;
  /** Humanize a raw key for the axis. */
  labelFor?: (key: string) => string;
  unit?: string;
  className?: string;
  ariaLabel?: string;
}

/** Responsive vertical bar chart with hover readout. */
export function BarChart({
  data,
  color = BRAND,
  height = 220,
  labelFor = (key) => key,
  unit = "",
  className,
  ariaLabel = "Bar chart",
}: BarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const pad = { top: 14, right: 8, bottom: 30, left: 40 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);
  const max = Math.max(1, ...data.map((item) => item.count));
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(46, slot * 0.55));

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left - pad.left;
    const index = Math.floor(localX / slot);
    if (index < 0 || index >= data.length) {
      setActive(null);
      return;
    }
    setActive(index);
  };

  const activeItem = active !== null ? data[active] : null;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {width > 0 && data.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={handleMove}
          onPointerLeave={() => setActive(null)}
        >
          {[0, 0.5, 1].map((fraction) => {
            const gy = pad.top + innerH * (1 - fraction);
            return (
              <g key={fraction}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={gy}
                  y2={gy}
                  className="stroke-line"
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

          {data.map((item, index) => {
            const barH = (item.count / max) * innerH;
            const cx = pad.left + slot * index + slot / 2;
            const bx = cx - barW / 2;
            const by = pad.top + innerH - barH;
            const isActive = active === index;
            return (
              <g key={item.key}>
                <rect
                  x={bx}
                  y={by}
                  width={barW}
                  height={Math.max(0, barH)}
                  rx={4}
                  fill={color}
                  opacity={active === null || isActive ? 1 : 0.45}
                />
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-[color:var(--m-tx-3)] text-[10px]"
                >
                  {labelFor(item.key).length > 8
                    ? `${labelFor(item.key).slice(0, 7)}…`
                    : labelFor(item.key)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {activeItem && active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-xs shadow-pop"
          style={{
            left: pad.left + slot * active + slot / 2,
            top: pad.top + innerH - (activeItem.count / max) * innerH - 8,
          }}
        >
          <p className="font-semibold text-1">
            {activeItem.count}
            {unit ? ` ${unit}` : ""}
          </p>
          <p className="text-3">{labelFor(activeItem.key)}</p>
        </div>
      )}

      {data.length === 0 && (
        <p className="py-10 text-center text-sm text-3">No data yet.</p>
      )}
    </div>
  );
}
