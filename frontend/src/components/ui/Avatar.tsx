import { User } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-line",
        src ? "bg-gradient-brand" : "bg-primary-soft text-primary",
        sizes[size],
        className,
      )}
      aria-label={name}
      role="img"
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <User className="size-[58%]" strokeWidth={1.75} aria-hidden />
      )}
    </div>
  );
}
