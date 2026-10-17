import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  content,
  children,
  className,
}: {
  content: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-opacity group-hover/tooltip:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
