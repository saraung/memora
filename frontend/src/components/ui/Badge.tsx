import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "neutral" | "success" | "warning" | "danger";

const variants: Record<Variant, string> = {
  brand: "bg-primary-soft text-primary",
  neutral: "bg-muted text-2",
  success: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function Badge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
