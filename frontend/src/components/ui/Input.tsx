import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-1"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            "h-10 w-full rounded-xl border bg-surface px-3.5 text-sm text-1 placeholder:text-3",
            "transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-3",
            error
              ? "border-red-500 focus:border-red-500"
              : "border-line hover:border-line-strong focus:border-primary",
            className,
          )}
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-2">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type">
>(({ label, error, hint, id, name, className, ...rest }, ref) => {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          name={name}
          ref={ref}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            "h-10 w-full rounded-xl border bg-surface px-3.5 pr-11 text-sm text-1 placeholder:text-3",
            "transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-3",
            error
              ? "border-red-500 focus:border-red-500"
              : "border-line hover:border-line-strong focus:border-primary",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-3 transition-colors hover:bg-muted hover:text-2"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
