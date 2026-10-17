import { Settings as SettingsIcon, ShieldCheck, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, PageHeader } from "@/components/feedback/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { roleLabel } from "@/lib/labels";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Console configuration and your staff access."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-bold text-1">
            <SettingsIcon className="size-4 text-3" aria-hidden /> Console
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Application" value="Memora Admin" />
            <Row label="Environment" value={import.meta.env.MODE} />
            <Row label="API base URL" value={API_BASE} mono />
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-bold text-1">
            <UserCog className="size-4 text-3" aria-hidden /> Your access
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label="Signed in as"
              value={
                user ? `${user.display_name} (@${user.username})` : "—"
              }
            />
          </dl>
          <div className="mt-3">
            <p className="text-xs font-semibold tracking-wide text-3 uppercase">
              Roles
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user?.roles.length ? (
                user.roles.map((role) => (
                  <Badge key={role} variant="brand">
                    {roleLabel(role)}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-3">None</span>
              )}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold tracking-wide text-3 uppercase">
              Permissions
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user?.permissions.length ? (
                user.permissions.map((code) => (
                  <Badge key={code} variant="info">
                    {code}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-3">None</span>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-bold text-1">
          <ShieldCheck className="size-4 text-3" aria-hidden /> Platform settings
        </h2>
        <div className="mt-4">
          <EmptyState
            title="Read-only"
            message="Feature flags, rate limits, and branding are managed via backend configuration and are not yet exposed by the API."
          />
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="text-2">{label}</dt>
      <dd className={mono ? "font-mono text-xs text-1" : "font-medium text-1"}>
        {value}
      </dd>
    </div>
  );
}
