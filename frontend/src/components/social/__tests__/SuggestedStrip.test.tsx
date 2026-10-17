import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SuggestedStrip } from "@/components/social/SuggestedStrip";

vi.mock("@/features/social/useSuggestedUsers", () => ({
  useSuggestedUsers: () => ({
    data: [
      {
        id: "u2",
        username: "bob",
        display_name: "Bob",
        avatar_url: null,
        is_verified: false,
        follower_count: 12,
      },
    ],
    isPending: false,
    isError: false,
  }),
}));

function renderStrip() {
  const client = new QueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <SuggestedStrip />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("SuggestedStrip", () => {
  it("renders suggested accounts with follow actions", () => {
    renderStrip();
    expect(screen.getByText("Suggested for you")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /follow/i }),
    ).toBeInTheDocument();
  });
});
