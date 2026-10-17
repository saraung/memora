import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Brand icon (no text) — used for compact/standalone placements. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/memora-icon.png"
      alt=""
      aria-hidden
      draggable={false}
      className={cn("size-9 shrink-0 rounded-lg select-none", className)}
    />
  );
}

/** Full lockup: brand icon + wordmark, linking to the overview. */
export function Logo({
  to = "/",
  className,
}: {
  to?: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn("flex items-center gap-2.5", className)}
      aria-label="Memora Admin overview"
    >
      <LogoMark />
      <span className="font-display text-xl font-extrabold tracking-tight text-gradient-brand">
        Memora
      </span>
    </Link>
  );
}
