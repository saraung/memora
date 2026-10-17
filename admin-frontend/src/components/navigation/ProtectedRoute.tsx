import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/features/auth/useAuth";
import type { PermissionCode } from "@/lib/permissions";

/** Renders children only for authenticated staff (any permission). */
export function ProtectedRoute() {
  const { status, isStaff } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageSpinner label="Restoring your session…" />;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isStaff) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
}

/** Redirects authenticated staff away from the sign-in screen. */
export function GuestRoute() {
  const { status, isStaff } = useAuth();

  if (status === "loading") {
    return <FullPageSpinner label="Loading…" />;
  }
  if (status === "authenticated") {
    return <Navigate to={isStaff ? "/" : "/403"} replace />;
  }
  return <Outlet />;
}

/** Requires a specific permission; otherwise shows the access-denied page. */
export function RequirePermission({ code }: { code: PermissionCode }) {
  const { status, hasPermission } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageSpinner label="Loading…" />;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!hasPermission(code)) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
}
