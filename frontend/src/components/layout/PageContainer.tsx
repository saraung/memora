import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single centred column every page renders through. Using one width
 * for the whole app keeps the gap between the sidebar and the content
 * identical on every tab.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl", className)}>{children}</div>
  );
}
