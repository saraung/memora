import { Link } from "react-router-dom";
import { ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, PageHeader } from "@/components/feedback/StateViews";
import { useRoles, useStaff } from "@/features/staff/hooks";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/types/admin";

export function StaffPage() {
  const roles = useRoles();
  const staff = useStaff();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & roles"
        description="Role catalog, permissions, and who holds what."
      />

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-1">
          <ShieldCheck className="size-4 text-3" aria-hidden /> Role catalog
        </h2>
        {roles.isError ? (
          <ErrorState title="Could not load roles" onRetry={() => void roles.refetch()} />
        ) : roles.isPending ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.data.map((role) => (
              <RoleCard
                key={role.name}
                role={role}
                holders={
                  staff.data?.filter((m) => m.roles.includes(role.name))
                    .length ?? 0
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-1">
          <Users className="size-4 text-3" aria-hidden /> Staff directory
        </h2>
        {staff.isError ? (
          <ErrorState title="Could not load staff" onRetry={() => void staff.refetch()} />
        ) : staff.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : staff.data.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6 text-primary" aria-hidden />}
            title="No staff yet"
            message="Grant roles from a user's detail page."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Roles</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Since</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.data.map((member) => (
                <TableRow key={member.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.display_name} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-1">
                          {member.display_name}
                        </p>
                        <p className="truncate text-xs text-3">
                          @{member.username} · {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.roles.map((role) => (
                        <Badge key={role} variant="brand">
                          {roleLabel(role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={member.account_status} />
                  </TableCell>
                  <TableCell className="text-sm text-2">
                    {formatDate(member.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/users/${member.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Manage
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

function RoleCard({ role, holders }: { role: Role; holders: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-extrabold text-1">
            {roleLabel(role.name)}
          </h3>
          <p className="mt-0.5 text-sm text-2">
            {role.description || "No description."}
          </p>
        </div>
        <Badge variant="neutral">{holders} holder{holders === 1 ? "" : "s"}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {role.permissions.length === 0 ? (
          <span className="text-xs text-3">No permissions</span>
        ) : (
          role.permissions.map((code) => (
            <Badge key={code} variant="info">
              {permissionLabel(code)}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

function permissionLabel(code: string): string {
  return code
    .split(":")
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
