import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { FeedList } from "@/components/content/FeedList";
import type { Post } from "@/types/content";

vi.mock("@/features/social/useSuggestedUsers", () => ({
  useSuggestedUsers: () => ({
    data: [],
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useInfiniteScroll", () => ({
  useInfiniteScroll: () => ({ current: null }),
}));

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    caption: "Hello",
    author: {
      id: "user-1",
      username: "alice",
      display_name: "Alice",
      avatar_url: null,
      is_verified: false,
    },
    media: [
      {
        id: "media-1",
        resource_type: "image",
        format: "jpg",
        width: 800,
        height: 600,
        duration: null,
        secure_url: "https://example.com/a.jpg",
        alt_text: null,
      },
    ],
    like_count: 0,
    comment_count: 0,
    liked: false,
    bookmarked: false,
    source: "following",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("FeedList", () => {
  it("labels the start of the discovery section", () => {
    const client = new QueryClient();
    const query = {
      data: {
        pages: [
          {
            items: [
              post({ id: "p1", source: "following" }),
              post({ id: "p2", source: "discovery" }),
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    };
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <FeedList
              query={query}
              emptyTitle="Empty"
              emptyMessage="Nothing here"
              showSuggestions
            />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Popular right now")).toBeInTheDocument();
  });
});
