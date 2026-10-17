import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Could not log out.",
        "error",
      );
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-muted">
        <Link
          to={`/u/${user.username}`}
          aria-label="Your profile"
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <Avatar
            name={user.display_name || user.username}
            src={user.avatar_url}
            size="sm"
          />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-bold text-1">
              {user.display_name}
            </span>
            <span className="block truncate text-xs text-2">
              @{user.username}
            </span>
          </span>
        </Link>
        <DropdownMenu
          label="Account menu"
          side="top"
          trigger={
            <button
              type="button"
              aria-label="Open account menu"
              className="flex cursor-pointer items-center rounded-lg p-1 text-3 transition-colors hover:bg-surface hover:text-2"
            >
              <ChevronsUpDown className="size-4 shrink-0" aria-hidden />
            </button>
          }
          items={[
            {
              label: "Log out",
              icon: <LogOut className="size-4" aria-hidden />,
              danger: true,
              onSelect: () => setConfirmOpen(true),
            },
          ]}
        />
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Log out?"
        description="You'll need to sign in again to use Memora."
        confirmLabel="Log out"
        loading={busy}
      />
    </>
  );
}
