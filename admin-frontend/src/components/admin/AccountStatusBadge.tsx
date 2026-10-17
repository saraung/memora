import { Badge } from "@/components/ui/Badge";
import type { AccountStatus } from "@/types/auth";

const LABELS: Record<AccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
  deleted: "Deleted",
};

const VARIANTS: Record<
  AccountStatus,
  "success" | "danger" | "warning" | "neutral"
> = {
  active: "success",
  suspended: "danger",
  deactivated: "warning",
  deleted: "neutral",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
