import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Flag, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { ErrorState, PageHeader } from "@/components/feedback/StateViews";
import { useToast } from "@/components/ui/Toast";
import { useDecideReport, useReport } from "@/features/reports/hooks";
import { useAuth } from "@/features/auth/useAuth";
import { PERM } from "@/lib/permissions";
import { formatDateTime, shortId, timeAgo } from "@/lib/format";
import {
  CATEGORY_LABELS,
  DECISION_LABELS,
  type ModerationDecision,
  type ReportCategory,
} from "@/types/moderation";

const DECISION_OPTIONS = Object.keys(DECISION_LABELS) as ModerationDecision[];
const DESTRUCTIVE: ModerationDecision[] = [
  "remove_content",
  "restrict",
  "suspend",
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-3 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-1">{children}</dd>
    </div>
  );
}

export function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const report = useReport(reportId);
  const decide = useDecideReport(reportId ?? "");
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canReview = hasPermission(PERM.REPORTS_REVIEW);
  const canRemove = hasPermission(PERM.CONTENT_REMOVE);
  const decisionOptions = DECISION_OPTIONS.filter(
    (option) => option !== "remove_content" || canRemove,
  );

  const [decision, setDecision] = useState<ModerationDecision>("dismiss");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (report.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (report.isError || !report.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState
          title="Could not load this report"
          onRetry={() => void report.refetch()}
        />
      </div>
    );
  }

  const data = report.data;
  const decided = data.status === "action_taken" || data.status === "dismissed";

  const submit = () => {
    setFormError(null);
    if (!reason.trim()) {
      setFormError("A reason is required for moderation decisions.");
      setConfirmOpen(false);
      return;
    }
    decide.mutate(
      { decision, reason: reason.trim() },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setReason("");
          toast("Decision recorded.", "success");
        },
        onError: (error) => {
          setConfirmOpen(false);
          setFormError(
            error instanceof Error ? error.message : "Could not apply decision.",
          );
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title="Report details"
        description={`Report ${shortId(data.id)}`}
        actions={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-1">
              <Flag className="size-4 text-3" aria-hidden /> Report
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Badge variant="brand">
                  {CATEGORY_LABELS[data.category as ReportCategory]}
                </Badge>
              </Field>
              <Field label="Target">
                {data.target_type}
                <span className="text-4"> · {data.target_id}</span>
              </Field>
              <Field label="Reporter">
                {data.reporter ? (
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon className="size-3.5 text-3" aria-hidden />@
                    {data.reporter.username}
                  </span>
                ) : (
                  "Anonymous"
                )}
              </Field>
              <Field label="Filed">{formatDateTime(data.created_at)}</Field>
              <Field label="Assigned to">
                {data.assignee ? `@${data.assignee.username}` : "Unassigned"}
              </Field>
              <Field label="Last updated">
                {formatDateTime(data.updated_at)}
              </Field>
            </dl>
            {data.details && (
              <div className="mt-5 rounded-lg border border-line bg-muted/40 p-3">
                <p className="text-xs font-semibold tracking-wide text-3 uppercase">
                  Reporter’s notes
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-1">
                  {data.details}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface shadow-card">
            <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              <Clock className="size-4 text-3" aria-hidden />
              <h2 className="text-sm font-bold text-1">Action history</h2>
            </header>
            {data.actions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-3">
                No moderation actions recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {data.actions.map((action) => (
                  <li key={action.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-1">
                        {DECISION_LABELS[action.decision]}
                      </span>
                      <span className="text-xs text-3">
                        {timeAgo(action.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-2">{action.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="lg:col-span-1">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="text-sm font-bold text-1">Take action</h2>
            {!canReview ? (
              <p className="mt-2 text-sm text-2">
                You have read-only access to reports.
              </p>
            ) : decided ? (
              <p className="mt-2 text-sm text-2">
                This report has already been decided.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <Select
                  label="Decision"
                  value={decision}
                  onChange={(e) =>
                    setDecision(e.target.value as ModerationDecision)
                  }
                >
                  {decisionOptions.map((d) => (
                    <option key={d} value={d}>
                      {DECISION_LABELS[d]}
                    </option>
                  ))}
                </Select>
                <Textarea
                  label="Reason"
                  placeholder="Required. Explain the decision for the audit log."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                />
                {formError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {formError}
                  </p>
                )}
                <Button
                  className="w-full"
                  variant={DESTRUCTIVE.includes(decision) ? "danger" : "primary"}
                  onClick={() => setConfirmOpen(true)}
                  disabled={!reason.trim()}
                >
                  Apply decision
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title="Apply this decision?"
        description={`${DECISION_LABELS[decision]} — this is recorded in the audit log.`}
        confirmLabel="Confirm"
        danger={DESTRUCTIVE.includes(decision)}
        loading={decide.isPending}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/reports"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-2 hover:text-1"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back to reports
    </Link>
  );
}
