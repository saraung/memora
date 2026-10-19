import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import { RoleDialog } from "@/components/staff/RoleDialog";
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
  useDeleteRole,
  usePermissions,
  useRoles,
  useStaff,
} from "@/features/staff/hooks";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/types/admin";

export function StaffPage() {
  const roles = useRoles();
  const staff = useStaff();
  const permissions = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);
  const { toast } = useToast();
  const remove = useDeleteRole();

  const holdersOf = (name: string) =>
    staff.data?.filter((member) => member.roles.includes(name)).length ?? 0;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (role: Role) => {
    setEditing(role);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & roles"
        description="Create roles, shape their permissions, and see who holds what."
        actions={
          <Button onClick={openCreate} disabled={permissions.isPending}>
            <Plus className="size-4" aria-hidden /> New role
          </Button>
        }
      />

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-1">
          <ShieldCheck className="size-4 text-3" aria-hidden /> Role catalog
        </h2>
        {roles.isError ? (
          <ErrorState title="Could not load roles" onRetry={() => void roles.refetch()} />
        ) : roles.isPending ? (
          <div className="grid gap-4 lg:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {roles.data.map((role) => (
              <RoleCard
                key={role.name}
                role={role}
                holders={holdersOf(role.name)}
                onEdit={() => openEdit(role)}
                onDelete={() => setPendingDelete(role)}
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

      <RoleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        role={editing}
        permissions={permissions.data ?? []}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        danger
        title={`Delete ${pendingDelete ? roleLabel(pendingDelete.name) : "role"}?`}
        description="This permanently removes the role. It must have no members."
        confirmLabel="Delete role"
        loading={remove.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.name, {
            onSuccess: () => {
              toast("Role deleted.", "success");
              setPendingDelete(null);
            },
            onError: (error) => {
              toast((error as Error).message, "error");
              setPendingDelete(null);
            },
          });
        }}
      />
    </div>
  );
}

function RoleCard({
  role,
  holders,
  onEdit,
  onDelete,
}: {
  role: Role;
  holders: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isProtected = role.name === "admin";
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-extrabold text-1">
            {roleLabel(role.name)}
          </h3>
          <p className="mt-0.5 text-sm text-2">
            {role.description || "No description."}
          </p>
        </div>
        <Badge variant="neutral">
          {holders} holder{holders === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
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

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden /> Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isProtected || holders > 0}
          title={
            isProtected
              ? "The administrator role cannot be deleted"
              : holders > 0
                ? "Remove all members before deleting"
                : "Delete role"
          }
        >
          <Trash2 className="size-3.5" aria-hidden /> Delete
        </Button>
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
