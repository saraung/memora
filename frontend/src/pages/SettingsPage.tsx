import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, LogOut, Moon, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import {
  useBlocked,
  usePrivacy,
  useUnblock,
} from "@/features/social/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ApiError } from "@/services/api-client";

export function SettingsPage() {
  const { user, logoutAll } = useAuth();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const privacy = usePrivacy();
  const blocked = useBlocked();
  const unblock = useUnblock();
  const { theme, set: setTheme } = useTheme();

  if (!user) return null;

  const handleLogoutAll = async () => {
    setBusy(true);
    try {
      await logoutAll();
      toast("Signed out of all sessions.", "success");
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Could not sign out.",
        "error",
      );
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-display font-extrabold tracking-tight text-1">
        Settings
      </h1>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-1">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <Avatar
            name={user.display_name || user.username}
            src={user.avatar_url}
            size="lg"
          />
          <div>
            <p className="font-bold text-1">{user.display_name}</p>
            <p className="text-sm text-2">
              @{user.username} · {user.email}
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
          Edit your display name, bio, avatar and links from your{" "}
          <Link
            to={`/u/${user.username}`}
            className="font-semibold underline underline-offset-2"
          >
            profile page
          </Link>
          .
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-1">Privacy</h2>
        <div className="mt-3">
          <Switch
            checked={user.is_private}
            onChange={(next) => privacy.mutate(next)}
            disabled={privacy.isPending}
            label="Private account"
            description="Only approved followers can see your profile and content."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-1">Appearance</h2>
        <p className="mt-1 text-sm text-3">
          Pick how Memora looks on this device.
        </p>
        <div
          className="mt-3 inline-flex rounded-xl border border-line bg-muted p-1"
          role="group"
          aria-label="Theme"
        >
          {(
            [
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={
                "flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors " +
                (theme === value
                  ? "bg-surface text-1 shadow-sm"
                  : "text-3 hover:text-2")
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-1">Blocked accounts</h2>
        <div className="mt-3">
          {blocked.isPending ? (
            <ul className="divide-y divide-line" aria-label="Loading blocked accounts">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-9 w-20 rounded-xl" />
                </li>
              ))}
            </ul>
          ) : blocked.isError ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load blocked accounts.{" "}
              <button
                type="button"
                onClick={() => blocked.refetch()}
                className="cursor-pointer font-semibold underline"
              >
                Retry
              </button>
            </p>
          ) : blocked.data.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-2">
              <Ban className="size-4" aria-hidden />
              You haven&apos;t blocked anyone.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {blocked.data.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <Avatar
                    name={entry.display_name || entry.username}
                    src={entry.avatar_url}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-1">
                      {entry.display_name}
                    </span>
                    <span className="block truncate text-sm text-2">
                      @{entry.username}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unblock.mutate(entry.id)}
                    loading={unblock.isPending}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-1">Sessions</h2>
        <p className="mt-1 text-sm text-2">
          Signed in on this device via a rotating refresh session. Use this to
          sign out everywhere at once.
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            className="gap-2"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out of all sessions
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleLogoutAll}
        title="Sign out everywhere?"
        description="This revokes every active session on all devices."
        confirmLabel="Sign out everywhere"
        danger
        loading={busy}
      />
    </PageContainer>
  );
}
