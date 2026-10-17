import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Clapperboard,
  Compass,
  Home,
  MessageCircle,
  PlusSquare,
  Search,
  Settings,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/navigation/Logo";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { UserMenu } from "@/components/navigation/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/explore", label: "Explore", icon: Compass, end: false },
  { to: "/search", label: "Search", icon: Search, end: false },
  { to: "/compose", label: "Create", icon: PlusSquare, end: false },
  { to: "/moments", label: "Moments", icon: Clapperboard, end: false },
  { to: "/messages", label: "Messages", icon: MessageCircle, end: false },
  { to: "/requests", label: "Requests", icon: UserPlus, end: false },
  { to: "/bookmarks", label: "Saved", icon: Bookmark, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
  { to: "/notifications", label: "Notifications", icon: Bell, end: false },
];

// Bottom-bar destinations (Requests lives in the sidebar + Home banner).
// Saved lives on the profile's Saved tab on mobile.
const MOBILE_NAV = [NAV[0], NAV[1], NAV[3], NAV[4], NAV[5]];

function DesktopSidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
      <Logo className="px-2" />
      <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors group",
                isActive
                  ? "bg-primary-soft text-primary"
                  : "text-2 hover:bg-muted hover:text-1",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-gradient-brand"
                  />
                )}
                <item.icon
                  className={cn("size-5 transition-transform group-hover:scale-105", isActive && "text-primary")}
                  aria-hidden
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line pt-3">
        <UserMenu />
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-0.5">
          <NavLink
            to="/search"
            aria-label="Search"
            className="rounded-lg p-2 text-2 transition-colors hover:bg-muted hover:text-1"
          >
            <Search className="size-5" aria-hidden />
          </NavLink>
          <NotificationBell />
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="rounded-lg p-2 text-2 transition-colors hover:bg-muted hover:text-1"
          >
            <Settings className="size-5" aria-hidden />
          </NavLink>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
    <div className="flex items-center justify-stretch gap-0.5">
      {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 items-center justify-center py-3 transition-colors",
                isActive ? "text-primary" : "text-3 active:text-2",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="size-6" aria-hidden />
                <span
                  aria-hidden
                  className={
                    "absolute bottom-1 size-1 rounded-full transition-opacity " +
                    (isActive ? "opacity-100 bg-gradient-brand" : "opacity-0")
                  }
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** A chat thread is immersive on mobile: no app chrome, no shell padding. */
const THREAD_ROUTE = /^\/messages\/[^/]+$/;

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const immersive = THREAD_ROUTE.test(pathname);
  const profileItem: NavItem | null = user
    ? {
        to: `/u/${user.username}`,
        label: "Profile",
        icon: User,
        end: false,
      }
    : null;
  const desktopNav = profileItem ? [...NAV, profileItem] : NAV;
  const mobileNav = profileItem ? [...MOBILE_NAV, profileItem] : MOBILE_NAV;

  return (
    <div className="min-h-screen bg-muted/60">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <DesktopSidebar items={desktopNav} />
        <div className="min-w-0 flex-1">
          {!immersive && <TopBar />}
          <main
            className={cn(
              immersive
                ? "p-0 md:px-8 md:pt-6 md:pb-10"
                : "px-4 py-6 pb-24 md:px-8 md:pb-10",
            )}
          >
            <Outlet />
          </main>
          {!immersive && <MobileBottomNav items={mobileNav} />}
        </div>
      </div>
    </div>
  );
}
