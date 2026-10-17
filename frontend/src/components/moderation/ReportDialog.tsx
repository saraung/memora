import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormError } from "@/components/ui/FormError";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useSubmitReport } from "@/features/moderation/hooks";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils";
import {
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportTarget,
} from "@/types/moderation";

const TARGET_NOUN: Record<ReportTarget["type"], string> = {
  user: "account",
  post: "post",
  reel: "moment",
};

interface ReportContextValue {
  openReport: (target: ReportTarget) => void;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used within ReportProvider");
  return ctx;
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);

  const openReport = useCallback((next: ReportTarget) => setTarget(next), []);
  const value = useMemo(() => ({ openReport }), [openReport]);

  return (
    <ReportContext.Provider value={value}>
      {children}
      {target && (
        <ReportDialog target={target} onClose={() => setTarget(null)} />
      )}
    </ReportContext.Provider>
  );
}

function ReportDialog({
  target,
  onClose,
}: {
  target: ReportTarget;
  onClose: () => void;
}) {
  const submit = useSubmitReport();
  const { toast } = useToast();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const noun = TARGET_NOUN[target.type];
  const subject = target.label ? ` ${target.label}` : "";

  const onSubmit = () => {
    if (!category) {
      setError("Choose a reason for your report.");
      return;
    }
    setError(null);
    submit.mutate(
      {
        target_type: target.type,
        target_id: target.id,
        category,
        details: details.trim() || null,
      },
      {
        onSuccess: () => {
          toast("Thanks — your report was submitted for review.", "success");
          onClose();
        },
        onError: (err) => {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not submit your report. Please try again.",
          );
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Report ${noun}`}
      description={`Tell us what's wrong with this${subject ? ` ${subject}` : ""} ${noun}. Reports are confidential.`}
    >
      <div className="space-y-4">
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Reason</legend>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {REPORT_CATEGORIES.map((option) => {
              const selected = category === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary-soft text-1"
                      : "border-line text-2 hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={option.value}
                    checked={selected}
                    onChange={() => setCategory(option.value)}
                    className="size-4 accent-[var(--m-primary)]"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Textarea
          name="details"
          label="Add details (optional)"
          placeholder="Share any context that helps our team review this."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={2000}
        />

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            loading={submit.isPending}
            disabled={!category}
          >
            <Flag className="size-4" aria-hidden />
            Submit report
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
