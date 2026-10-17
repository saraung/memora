import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "@/pages/OverviewPage";
import type { OverviewStats } from "@/types/analytics";

const stats: OverviewStats = {
  generated_at: new Date().toISOString(),
  range_days: 14,
  accounts: {
    total: 1240,
    active: 1180,
    suspended: 12,
    deactivated: 48,
    new_7d: 32,
    new_30d: 210,
  },
  content: { posts: 540, reels: 88, stories: 12, comments: 900, messages: 3200 },
  social: { follows: 4100 },
  reports: {
    total: 57,
    pending: 4,
    under_review: 2,
    action_taken: 31,
    dismissed: 20,
    last_7d: 9,
  },
  staff: { total: 3, active: 3 },
  signups_series: [
    { date: "2026-10-16", value: 5 },
    { date: "2026-10-17", value: 8 },
  ],
  posts_series: [
    { date: "2026-10-16", value: 12 },
    { date: "2026-10-17", value: 9 },
  ],
  reports_series: [
    { date: "2026-10-16", value: 1 },
    { date: "2026-10-17", value: 3 },
  ],
  reports_by_category: [{ key: "spam", count: 30 }],
  reports_by_status: [
    { key: "pending", count: 4 },
    { key: "dismissed", count: 20 },
  ],
  roles: [{ key: "admin", count: 1 }],
};

vi.mock("@/features/analytics/hooks", () => ({
  useOverviewStats: () => ({
    data: stats,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/features/reports/hooks", () => ({
  useOverview: () => ({
    pendingCount: 4,
    pendingCapped: false,
    activity: {
      data: { items: [] },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    },
  }),
}));

describe("OverviewPage", () => {
  it("shows KPI figures and chart panels from the stats payload", () => {
    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("1.2k").length).toBeGreaterThan(0);
    expect(screen.getByText(/\+32 this week/)).toBeInTheDocument();
    expect(screen.getAllByText("540").length).toBeGreaterThan(0);
    expect(screen.getByText("New signups")).toBeInTheDocument();
    expect(screen.getByText("Reports by status")).toBeInTheDocument();
    expect(screen.getByText("Staff by role")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });
});
