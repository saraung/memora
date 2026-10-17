import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportsPage } from "@/pages/ReportsPage";

const report = {
  id: "r1",
  reporter: {
    id: "u1",
    username: "bob",
    display_name: "Bob",
    avatar_url: null,
    is_verified: false,
    last_seen_at: null,
  },
  target_type: "post",
  target_id: "p_abcdef123456",
  category: "spam",
  details: null,
  status: "pending",
  assignee: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

vi.mock("@/features/reports/hooks", () => ({
  useReports: () => ({
    data: { pages: [{ items: [report] }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

describe("ReportsPage", () => {
  it("renders report rows with category, reporter and a review link", () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("cell", { name: "Spam" })).toBeInTheDocument();
    expect(screen.getByText(/@bob/)).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Pending" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute(
      "href",
      "/reports/r1",
    );
  });
});
