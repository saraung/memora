import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ProtectedRoute,
  RequirePermission,
} from "@/components/navigation/ProtectedRoute";
import { PERM } from "@/lib/permissions";

const auth = {
  status: "authenticated" as const,
  isStaff: true,
  hasPermission: () => true,
};

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => auth,
}));

function Shell() {
  return <div>Staff content</div>;
}

describe("route guards", () => {
  it("lets authorized staff through", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<RequirePermission code={PERM.REPORTS_READ} />}>
              <Route index element={<Shell />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Staff content")).toBeInTheDocument();
  });

  it("redirects anonymous users to sign-in", () => {
    Object.assign(auth, { status: "anonymous", isStaff: false });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/login" element={<div>Sign-in screen</div>} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<Shell />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Sign-in screen")).toBeInTheDocument();
    Object.assign(auth, { status: "authenticated", isStaff: true });
  });

  it("blocks staff lacking the required permission", () => {
    Object.assign(auth, {
      status: "authenticated",
      isStaff: true,
      hasPermission: () => false,
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/403" element={<div>Access denied</div>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<RequirePermission code={PERM.REPORTS_READ} />}>
              <Route index element={<Shell />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    Object.assign(auth, {
      status: "authenticated",
      isStaff: true,
      hasPermission: () => true,
    });
  });
});
