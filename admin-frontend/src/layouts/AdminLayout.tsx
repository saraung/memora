import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { MobileDrawer, Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";

const SIDEBAR_KEY = "memora.admin.sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persistent sidebar (desktop) + drawer (mobile) shell for staff screens. */
export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore storage failures (private mode) */
    }
  }, [collapsed]);

  return (
    <div className="flex min-h-dvh bg-app">
      <Sidebar collapsed={collapsed} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenNav={() => setDrawerOpen(true)}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((value) => !value)}
        />
        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
