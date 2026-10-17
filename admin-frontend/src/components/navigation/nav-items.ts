import {
  BarChart3,
  FileWarning,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PERM, type PermissionCode } from "@/lib/permissions";

export type NavGroup = "Main" | "Insights" | "System";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionCode;
  group: NavGroup;
  /** Match nested routes (e.g. /reports/:id keeps "Reports" active). */
  matchPrefix?: string;
}

export const NAV_GROUP_ORDER: NavGroup[] = ["Main", "Insights", "System"];

/** Sidebar entries — each gated by the permission its screen requires. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Overview",
    icon: LayoutDashboard,
    permission: PERM.REPORTS_READ,
    group: "Main",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: FileWarning,
    permission: PERM.REPORTS_READ,
    group: "Main",
    matchPrefix: "/reports",
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    permission: PERM.USERS_READ,
    group: "Main",
    matchPrefix: "/users",
  },
  {
    to: "/staff",
    label: "Staff & roles",
    icon: ShieldCheck,
    permission: PERM.STAFF_MANAGE,
    group: "Main",
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: PERM.ANALYTICS_READ,
    group: "Insights",
  },
  {
    to: "/audit-logs",
    label: "Audit logs",
    icon: ScrollText,
    permission: PERM.AUDIT_READ,
    group: "Insights",
    matchPrefix: "/audit-logs",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    permission: PERM.SETTINGS_READ,
    group: "System",
  },
];
