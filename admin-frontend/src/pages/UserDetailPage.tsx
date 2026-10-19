import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BadgeCheck,
  ArrowLeft,
  FileWarning,
  Lock,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import { StatusBadge } from "@/components/reports/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, PageHeader } from "@/components/feedback/StateViews";
import {
  useGrantRole,
  useRevokeRole,
  useSetAccountStatus,
  useUserDetail,
} from "@/features/users/hooks";
import { useRoles } from "@/features/staff/hooks";
import { useAuth } from "@/features/auth/useAuth";
import { PERM } from "@/lib/permissions";
import { categoryLabel, roleLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import type { AccountStatus } from "@/types/auth";
import type { ReportStatus } from "@/types/moderation";

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { hasPermission, user: me } = useAuth();
  const detail = useUserDetail(userId);

  if (detail.isPending) return <FullPageSpinner label="Loading account…" />;
  if (detail.isError || !detail.data) {
    return (
      <ErrorState
        title="Could not load account"
        onRetry={() => void detail.refetch()}
        action={
          <Link
            to="/users"
            className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:underline"
          >
            Back to users
          </Link>
        }
      />
    );
  }

  const account = detail.data;
  const isSelf = me?.id === account.id;

  return (
    <div className="space-y-6">
      <Link
        to="/users"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-2 hover:text-1"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to users
      </Link>

      <PageHeader
        title={account.display_name}
        description={`@${account.username} · ${account.email}`}
        actions={<AccountStatusBadge status={account.account_status} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {account.is_verified && (
          <Badge variant="info">
            <BadgeCheck className="size-3.5" aria-hidden /> Verified
          </Badge>
        )}
        <Badge variant={account.is_private ? "warning" : "neutral"}>
          <Lock className="size-3.5" aria-hidden />
          {account.is_private ? "Private" : "Public"}
        </Badge>
        {account.roles.map((role) => (
          <Badge key={role} variant="brand">
            {roleLabel(role)}
          </Badge>
        ))}
        <span className="text-xs text-3">
          Joined {formatDate(account.created_at)}
        </span>
      </div>

      <div className="grid gap-4 lg:gap-6 sm:grid-cols-3">
        <MetricTile label="Followers" value={account.followers} />
        <MetricTile label="Following" value={account.following} />
        <MetricTile label="Posts" value={account.posts} />
      </div>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
        <AccountStandingCard
          accountId={account.id}
          status={account.account_status}
          isSelf={isSelf}
          canManage={hasPermission(PERM.USERS_SUSPEND)}
        />
        <RolesCard
          accountId={account.id}
          roles={account.roles}
          isSelf={isSelf}
          canManage={hasPermission(PERM.STAFF_MANAGE)}
        />
      </div>

      <section className="rounded-xl border border-line bg-surface shadow-card">
        <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <FileWarning className="size-4 text-3" aria-hidden />
          <h2 className="text-sm font-bold text-1">Reports against this account</h2>
        </header>
        {account.recent_reports.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ShieldCheck className="size-6 text-primary" aria-hidden />}
              title="No reports"
              message="This account has no reports filed against it."
            />
          </div>
        ) : (
          <Table className="rounded-none border-0 shadow-none">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Reason</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Filed</TableHeaderCell>
                <TableHeaderCell className="text-right">Report</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {account.recent_reports.map((report) => (
                <TableRow key={report.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    {categoryLabel(report.category)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={report.status as ReportStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-2">
                    {formatDate(report.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/reports/${report.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold tracking-wide text-3 uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-display font-extrabold text-1 tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function AccountStandingCard({
  accountId,
  status,
  isSelf,
  canManage,
}: {
  accountId: string;
  status: AccountStatus;
  isSelf: boolean;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const mutation = useSetAccountStatus(accountId);
  const [target, setTarget] = useState<AccountStatus | null>(null);
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!target) return;
    mutation.mutate(
      { status: target, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`Account ${statusVerb(target)}.`, "success");
          setTarget(null);
          setReason("");
        },
        onError: (error) => toast((error as Error).message, "error"),
      },
    );
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-sm font-bold text-1">Account standing</h2>
      <p className="mt-1 text-sm text-2">
        Suspend, restore, or deactivate this account. Actions are audited and
        notify the member.
      </p>

      {!canManage ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-2">
          You lack <code className="text-primary">users:suspend</code> — read-only.
        </p>
      ) : isSelf ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-2">
          You cannot change your own account status.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {status !== "active" && (
            <Button
              size="sm"
              onClick={() => setTarget("active")}
              variant="primary"
            >
              <UserCheck className="size-4" aria-hidden /> Restore
            </Button>
          )}
          {status === "active" && (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setTarget("suspended")}
              >
                <UserX className="size-4" aria-hidden /> Suspend
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTarget("deactivated")}
              >
                Deactivate
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog
        open={target !== null}
        onClose={() => {
          setTarget(null);
          setReason("");
        }}
        title={target ? `${statusVerb(target)} account` : ""}
        description="A reason is required and recorded in the audit log."
      >
        <div className="space-y-3">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain the decision…"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTarget(null);
                setReason("");
              }}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={target === "active" ? "primary" : "danger"}
              onClick={submit}
              loading={mutation.isPending}
              disabled={reason.trim().length === 0}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function RolesCard({
  accountId,
  roles,
  isSelf,
  canManage,
}: {
  accountId: string;
  roles: string[];
  isSelf: boolean;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const catalog = useRoles(canManage);
  const grant = useGrantRole(accountId);
  const revoke = useRevokeRole(accountId);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const available = (catalog.data ?? []).filter(
    (role) => !roles.includes(role.name),
  );

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-sm font-bold text-1">Staff roles</h2>
      <p className="mt-1 text-sm text-2">
        Grant or revoke access roles. Role changes are audited.
      </p>

      <div className="mt-4 space-y-2">
        {roles.length === 0 ? (
          <p className="text-sm text-3">No staff roles assigned.</p>
        ) : (
          roles.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-1">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                {roleLabel(role)}
              </span>
              {canManage && !isSelf && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingRevoke(role)}
                  loading={revoke.isPending}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {!canManage ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-2">
          You lack <code className="text-primary">staff:manage</code> — read-only.
        </p>
      ) : isSelf ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-2">
          You cannot change your own roles.
        </p>
      ) : (
        <div className="mt-4">
          <Select
            label="Grant a role"
            value=""
            disabled={grant.isPending || available.length === 0}
            onChange={(event) => {
              const role = event.target.value;
              if (!role) return;
              grant.mutate(role, {
                onSuccess: () => toast(`Granted ${roleLabel(role)}.`, "success"),
                onError: (error) => toast((error as Error).message, "error"),
              });
            }}
          >
            <option value="">
              {available.length === 0 ? "All roles assigned" : "Select a role…"}
            </option>
            {available.map((role) => (
              <option key={role.name} value={role.name}>
                {roleLabel(role.name)} — {role.description || "no description"}
              </option>
            ))}
          </Select>
        </div>
      )}

      <ConfirmDialog
        open={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        danger
        title={`Revoke ${pendingRevoke ? roleLabel(pendingRevoke) : ""}?`}
        description="The member will immediately lose this role's permissions."
        confirmLabel="Revoke role"
        loading={revoke.isPending}
        onConfirm={() => {
          if (!pendingRevoke) return;
          revoke.mutate(pendingRevoke, {
            onSuccess: () => {
              toast("Role revoked.", "success");
              setPendingRevoke(null);
            },
            onError: (error) => {
              toast((error as Error).message, "error");
              setPendingRevoke(null);
            },
          });
        }}
      />
    </section>
  );
}

function statusVerb(status: AccountStatus): string {
  switch (status) {
    case "active":
      return "restored";
    case "suspended":
      return "suspended";
    case "deactivated":
      return "deactivated";
    default:
      return "updated";
  }
}
