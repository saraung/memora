import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Consistent bordered panel for a chart with a title row. */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: ChartCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface p-5 shadow-card",
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-1">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-3">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
