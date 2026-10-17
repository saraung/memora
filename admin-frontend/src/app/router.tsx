import { createBrowserRouter } from "react-router-dom";
import {
  GuestRoute,
  ProtectedRoute,
  RequirePermission,
} from "@/components/navigation/ProtectedRoute";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ReportDetailPage } from "@/pages/ReportDetailPage";
import { UsersPage } from "@/pages/UsersPage";
import { UserDetailPage } from "@/pages/UserDetailPage";
import { StaffPage } from "@/pages/StaffPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PERM } from "@/lib/permissions";

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  { path: "/403", element: <ForbiddenPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            element: <RequirePermission code={PERM.REPORTS_READ} />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: "reports", element: <ReportsPage /> },
              { path: "reports/:reportId", element: <ReportDetailPage /> },
            ],
          },
          {
            element: <RequirePermission code={PERM.USERS_READ} />,
            children: [
              { path: "users", element: <UsersPage /> },
              { path: "users/:userId", element: <UserDetailPage /> },
            ],
          },
          {
            element: <RequirePermission code={PERM.STAFF_MANAGE} />,
            children: [{ path: "staff", element: <StaffPage /> }],
          },
          {
            element: <RequirePermission code={PERM.ANALYTICS_READ} />,
            children: [{ path: "analytics", element: <AnalyticsPage /> }],
          },
          {
            element: <RequirePermission code={PERM.AUDIT_READ} />,
            children: [{ path: "audit-logs", element: <AuditLogsPage /> }],
          },
          {
            element: <RequirePermission code={PERM.SETTINGS_READ} />,
            children: [{ path: "settings", element: <SettingsPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
