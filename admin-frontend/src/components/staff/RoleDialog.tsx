import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { useCreateRole, useUpdateRole } from "@/features/staff/hooks";
import { roleLabel } from "@/lib/labels";
import type { Permission, Role } from "@/types/admin";

const PROTECTED_ROLE = "admin";

export function RoleDialog({
  open,
  onClose,
  role,
  permissions,
}: {
  open: boolean;
  onClose: () => void;
  /** Existing role to edit, or null to create a new one. */
  role: Role | null;
  permissions: Permission[];
}) {
  const isEdit = role !== null;
  const { toast } = useToast();
  const create = useCreateRole();
  const update = useUpdateRole(role?.name ?? "");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissions ?? []));
  }, [open, role]);

  const locked = isEdit && role?.name === PROTECTED_ROLE;
  const pending = create.isPending || update.isPending;

  const toggle = (code: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const submit = () => {
    const payload = {
      name: isEdit ? undefined : name.trim().toLowerCase(),
      description: description.trim(),
      permissions: [...selected].sort(),
    };
    const handlers = {
      onSuccess: () => {
        toast(isEdit ? "Role updated." : "Role created.", "success");
        onClose();
      },
      onError: (error: unknown) => toast((error as Error).message, "error"),
    };
    if (isEdit) update.mutate(payload, handlers);
    else create.mutate(payload, handlers);
  };

  const canSubmit = isEdit || /^[a-z][a-z0-9_-]{1,63}$/.test(name.trim().toLowerCase());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${role ? roleLabel(role.name) : "role"}` : "New role"}
      description="Choose the capabilities this role grants. Changes are audited."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          disabled={isEdit}
          placeholder="e.g. triage"
          onChange={(event) => setName(event.target.value)}
          hint={isEdit ? undefined : "Lowercase letters, digits, dashes, underscores."}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is this role for?"
          className="min-h-16"
        />

        <div>
          <p className="mb-2 text-sm font-medium text-1">Permissions</p>
          {locked && (
            <p className="mb-2 rounded-lg bg-muted px-3 py-2 text-xs text-2">
              The administrator role always retains every permission.
            </p>
          )}
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {permissions.map((permission) => (
              <Checkbox
                key={permission.code}
                checked={selected.has(permission.code)}
                disabled={locked}
                onChange={(checked) => toggle(permission.code, checked)}
                label={permission.code}
                description={permission.description}
              />
            ))}
            {permissions.length === 0 && (
              <p className="text-sm text-3">No permissions available.</p>
            )}
          </div>
          {selected.size === 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              This role grants no access — members will be denied every screen.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={!canSubmit}>
            {isEdit ? "Save changes" : "Create role"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
