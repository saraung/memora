import { useId } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "./palette";

export interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

/** Tiny area sparkline (non-scaling stroke) for stat cards. */
export function Sparkline({
  values,
  color = BRAND,
  width = 120,
  height = 36,
  className,
}: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) {
    return <div className={cn("h-9", className)} aria-hidden />;
  }

  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (values.length - 1);

  const points = values.map((value, index) => {
    const px = pad + index * stepX;
    const py = pad + (height - pad * 2) * (1 - (value - min) / range);
    return [px, py] as const;
  });
  const line = points
    .map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
