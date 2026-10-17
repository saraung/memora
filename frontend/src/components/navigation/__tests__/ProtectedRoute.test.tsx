import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/navigation/ProtectedRoute";
import type { AuthStatus } from "@/hooks/useAuth";

let authStatus: AuthStatus = "anonymous";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: authStatus, user: null }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Sign in page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Private home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects anonymous users to login", () => {
    authStatus = "anonymous";
    renderAt("/");
    expect(screen.getByText("Sign in page")).toBeInTheDocument();
  });

  it("renders protected content when authenticated", () => {
    authStatus = "authenticated";
    renderAt("/");
    expect(screen.getByText("Private home")).toBeInTheDocument();
  });

  it("shows a loader while restoring the session", () => {
    authStatus = "loading";
    renderAt("/");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
