import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ConversationList } from "@/components/chat/ConversationList";
import { useConversations } from "@/features/chat/hooks";

const deleteMock = vi.fn();
const mockConversations = useConversations as unknown as Mock;

vi.mock("@/features/chat/hooks", () => ({
  useConversations: vi.fn(),
  useDeleteConversation: () => ({ mutate: deleteMock, isPending: false }),
}));

vi.mock("@/hooks/useInfiniteScroll", () => ({
  useInfiniteScroll: () => ({ current: null }),
}));

vi.mock("@/features/search/hooks", () => ({
  useUserSearch: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

function oneConversation() {
  return {
    data: {
      pages: [
        {
          items: [
            {
              id: "conv-1",
              other_user: {
                id: "u2",
                username: "bob",
                display_name: "Bob",
                avatar_url: null,
                is_verified: false,
              },
              last_message: {
                id: "m1",
                body: "hey",
                is_deleted: false,
                created_at: new Date().toISOString(),
              },
              unread_count: 0,
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
  };
}

function twoConversations() {
  const base = oneConversation().data.pages[0].items[0];
  return {
    ...oneConversation(),
    data: {
      pages: [
        {
          items: [
            base,
            {
              ...base,
              id: "conv-2",
              other_user: {
                id: "u3",
                username: "ada",
                display_name: "Ada",
                avatar_url: null,
                is_verified: false,
              },
              last_message: {
                id: "m2",
                body: "lunch?",
                is_deleted: false,
                created_at: new Date().toISOString(),
              },
            },
          ],
        },
      ],
    },
  };
}

describe("ConversationList", () => {
  it("explains the empty state", () => {
    mockConversations.mockReturnValue({
      data: { pages: [] },
      isPending: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter>
        <ToastProvider>
          <ConversationList />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
  });

  it("opens the row menu and deletes with confirmation", async () => {
    const user = userEvent.setup();
    mockConversations.mockReturnValue(oneConversation());
    render(
      <MemoryRouter>
        <ToastProvider>
          <ConversationList />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /options for conversation/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /delete conversation/i }));
    expect(
      screen.getByText(/disappear from your list/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(deleteMock).toHaveBeenCalledWith("conv-1");
  });

  it("filters conversations by the search query", async () => {
    const user = userEvent.setup();
    mockConversations.mockReturnValue(twoConversations());
    render(
      <MemoryRouter>
        <ToastProvider>
          <ConversationList />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: /search conversations/i }),
      "ada",
    );
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });
});
