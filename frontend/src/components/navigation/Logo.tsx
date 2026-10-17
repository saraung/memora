import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/memora-icon.png"
      alt=""
      aria-hidden
      draggable={false}
      className={cn("size-9 shrink-0 select-none", className)}
    />
  );
}

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn("flex items-center gap-2.5", className)}
      aria-label="Memora home"
    >
      <LogoMark />
      <span className="font-display text-xl font-extrabold tracking-tight text-gradient-brand">
        Memora
      </span>
    </Link>
  );
}
