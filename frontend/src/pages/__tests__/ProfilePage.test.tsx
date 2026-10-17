import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ProfilePage } from "@/pages/ProfilePage";
import { ApiError } from "@/services/api-client";

vi.mock("@/features/social/hooks", () => ({
  useProfile: () => ({
    isPending: false,
    isError: true,
    error: new ApiError("User not found", { status: 404, code: "RESOURCE_NOT_FOUND" }),
    refetch: vi.fn(),
  }),
  useFollowToggle: () => ({ mutate: vi.fn(), isPending: false }),
  useBlockToggle: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("ProfilePage", () => {
  it("explains private or missing profiles without leaking details", () => {
    render(
      <MemoryRouter initialEntries={["/u/ghost"]}>
        <ToastProvider>
          <Routes>
            <Route path="/u/:username" element={<ProfilePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Profile not available")).toBeInTheDocument();
  });
});
