import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { LogoMark } from "@/components/navigation/Logo";
import {
  NAV_GROUP_ORDER,
  NAV_ITEMS,
  type NavItem,
} from "@/components/navigation/nav-items";

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        collapsed ? "justify-center px-0" : "px-2",
      )}
    >
      <LogoMark className="size-8 shrink-0" />
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-display font-extrabold text-1">
            Memora Admin
          </p>
          <p className="text-[11px] text-3">Operations console</p>
        </div>
      )}
    </div>
  );
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  return (
    pathname === item.to ||
    (item.matchPrefix != null && pathname.startsWith(`${item.matchPrefix}/`))
  );
}

function SidebarLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  if (collapsed) {
    return (
      <nav
        className="flex flex-1 flex-col items-center gap-1 px-2"
        aria-label="Primary"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item, pathname);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-sidebar-active text-primary"
                  : "text-2 hover:bg-muted hover:text-1",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </NavLink>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-5 px-2" aria-label="Primary">
      {NAV_GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-bold tracking-wider text-4 uppercase">
              {group}
            </p>
            {groupItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item, pathname);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-sidebar-active text-primary"
                      : "text-2 hover:bg-muted hover:text-1",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar (collapsible icon rail). */
export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col gap-6 border-r border-line bg-sidebar py-5 transition-[width] duration-200 ease-out md:flex",
        collapsed ? "w-[4.75rem]" : "w-64",
      )}
    >
      <Brand collapsed={collapsed} />
      <SidebarLinks collapsed={collapsed} />
      {!collapsed && (
        <p className="px-4 text-[11px] text-4">
          Authorized staff only. Actions are audited.
        </p>
      )}
    </aside>
  );
}

/** Mobile slide-over drawer wrapping the same links. */
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-scrim animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-sidebar py-5 shadow-pop animate-rise">
        <div className="flex items-center justify-between px-3">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="cursor-pointer rounded-lg p-1.5 text-3 hover:bg-muted hover:text-2"
          >
            <X className="size-5" />
          </button>
        </div>
        <SidebarLinks onNavigate={onClose} />
      </div>
    </div>
  );
}
