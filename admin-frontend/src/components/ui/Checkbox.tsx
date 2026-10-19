import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border border-line p-3 transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-memora-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-1">{label}</span>
        {description && (
          <span className="block text-xs text-3">{description}</span>
        )}
      </span>
    </label>
  );
}
