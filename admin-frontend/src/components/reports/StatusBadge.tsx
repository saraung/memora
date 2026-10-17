import { Badge } from "@/components/ui/Badge";
import { STATUS_LABELS, type ReportStatus } from "@/types/moderation";

const VARIANTS: Record<
  ReportStatus,
  "warning" | "info" | "success" | "neutral"
> = {
  pending: "warning",
  under_review: "info",
  action_taken: "success",
  dismissed: "neutral",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
