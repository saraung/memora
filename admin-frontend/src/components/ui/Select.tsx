import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className, children, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-1"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-10 w-full cursor-pointer rounded-lg border bg-surface px-3 text-sm text-1",
            "transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-3",
            error
              ? "border-red-500"
              : "border-line hover:border-line-strong focus:border-primary",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        {error && (
          <p
            role="alert"
            className="mt-1.5 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
