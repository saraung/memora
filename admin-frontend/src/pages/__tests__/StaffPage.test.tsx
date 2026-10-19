import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaffPage } from "@/pages/StaffPage";
import { ToastProvider } from "@/components/ui/Toast";

const roles = [
  {
    name: "admin",
    description: "Full access",
    permissions: ["reports:read", "staff:manage"],
    holders: 1,
  },
  {
    name: "triage",
    description: "Triage the queue",
    permissions: ["reports:read"],
    holders: 0,
  },
];

const staff = [
  {
    id: "u1",
    email: "admin@example.com",
    username: "admin1",
    display_name: "Admin One",
    account_status: "active" as const,
    roles: ["admin"],
    created_at: new Date().toISOString(),
  },
];

vi.mock("@/features/staff/hooks", () => ({
  useRoles: () => ({
    data: roles,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useStaff: () => ({
    data: staff,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  usePermissions: () => ({
    data: [{ code: "reports:read", description: "View reports" }],
    isPending: false,
    isError: false,
  }),
  useDeleteRole: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRole: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateRole: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("StaffPage", () => {
  it("lists roles with holders and guards protected/held deletions", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <StaffPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /new role/i })).toBeInTheDocument();
    expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
    expect(screen.getByText("Triage")).toBeInTheDocument();
    expect(screen.getByText("1 holder")).toBeInTheDocument();
    expect(screen.getByText("0 holders")).toBeInTheDocument();

    const deletes = screen.getAllByRole("button", { name: /delete/i });
    expect(deletes[0]).toBeDisabled();
    expect(deletes[1]).toBeEnabled();
    expect(screen.getAllByRole("button", { name: /edit/i })[1]).toBeEnabled();
  });
});
