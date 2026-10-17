/** Shared composer selector: Post | Story | Moment (used on all 3 pages). */

import { Link, useLocation } from "react-router-dom";
import { Clapperboard, ImagePlus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/compose", label: "Post", icon: ImagePlus },
  { to: "/stories/new", label: "Story", icon: Zap },
  { to: "/moments/new", label: "Moment", icon: Clapperboard },
] as const;

export function ComposerTabs() {
  const { pathname } = useLocation();
  return (
    <div
      className="inline-flex rounded-2xl border border-line bg-muted p-1"
      role="tablist"
      aria-label="What do you want to share?"
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-surface text-primary shadow-sm"
                : "text-3 hover:text-2",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
