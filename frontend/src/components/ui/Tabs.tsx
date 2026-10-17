import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            active === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-2 hover:text-1",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
