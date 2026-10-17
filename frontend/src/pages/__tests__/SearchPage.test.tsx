import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { SearchPage } from "@/pages/SearchPage";

vi.mock("@/features/search/hooks", () => ({
  useUserSearch: () => ({
    data: {
      pages: [
        {
          items: [
            {
              id: "u1",
              username: "alice",
              display_name: "Alice",
              avatar_url: null,
              is_verified: false,
            },
          ],
        },
      ],
    },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  usePostSearch: () => ({
    data: { pages: [] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useHashtagSearch: () => ({
    data: { pages: [] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

describe("SearchPage", () => {
  it("starts with an empty state and searches people as you type", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <ToastProvider>
          <SearchPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Search Memora")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), "alice");
    expect(await screen.findByText("@alice")).toBeInTheDocument();
  });

  it("switches to the tags tab", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter>
        <ToastProvider>
          <SearchPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Search"), "mem");
    await user.click(screen.getByRole("tab", { name: "Tags" }));
    expect(
      await screen.findByText('No tags found for "mem"'),
    ).toBeInTheDocument();
  });
});
