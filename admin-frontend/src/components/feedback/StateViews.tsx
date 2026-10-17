import type { ReactNode } from "react";
import { CloudOff, Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
  action,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
        <CloudOff
          className="size-6 text-red-500 dark:text-red-400"
          aria-hidden
        />
      </span>
      <h3 className="mt-2 text-base font-bold text-1">{title}</h3>
      <p className="max-w-sm text-sm text-2">{message}</p>
      <div className="mt-3 flex gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
        {icon ?? <Inbox className="size-6 text-primary" aria-hidden />}
      </span>
      <h3 className="mt-2 text-base font-bold text-1">{title}</h3>
      {message && <p className="max-w-sm text-sm text-2">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Shared page heading with optional trailing actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-display font-extrabold tracking-tight text-1">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-2">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
