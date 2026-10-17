import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { MomentsPage } from "@/pages/MomentsPage";

vi.mock("@/features/ephemeral/hooks", () => ({
  useReelFeed: () => ({
    data: { pages: [] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useReelLike: () => ({ mutate: vi.fn() }),
  useRecordReelView: () => ({ mutate: vi.fn() }),
  useDeleteReel: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

describe("MomentsPage", () => {
  it("shows an empty state when there are no reels", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MomentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("No moments yet")).toBeInTheDocument();
  });
});
