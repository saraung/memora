import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/navigation/Logo";
import { useAuth } from "@/features/auth/useAuth";

export function Topbar({
  onOpenNav,
  collapsed,
  onToggleSidebar,
}: {
  onOpenNav: () => void;
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const { user, logout } = useAuth();
  const display = user?.display_name || user?.username || "Staff";
  const role = user?.roles[0] ?? "staff";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8 xl:px-10">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="cursor-pointer rounded-lg p-2 text-2 hover:bg-muted md:hidden"
      >
        <Menu className="size-5" />
      </button>
      <LogoMark className="size-8 rounded-md md:hidden" />

      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden cursor-pointer rounded-lg p-2 text-2 transition-colors hover:bg-muted hover:text-1 md:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5" />
        ) : (
          <PanelLeftClose className="size-5" />
        )}
      </button>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-1">{display}</p>
          <p className="text-[11px] capitalize text-3">{role}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
          {display.charAt(0).toUpperCase()}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          aria-label="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
