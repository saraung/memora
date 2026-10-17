import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { PostCard } from "@/components/content/PostCard";
import type { Post } from "@/types/content";

const likeMock = vi.fn();
const bookmarkMock = vi.fn();

vi.mock("@/features/content/hooks", () => ({
  useLike: () => ({ mutate: likeMock }),
  useBookmark: () => ({ mutate: bookmarkMock }),
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
        alt_text: "A photo",
      },
    ],
    like_count: 3,
    comment_count: 1,
    liked: false,
    bookmarked: false,
    source: "following",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("PostCard", () => {
  it("renders author, caption, counts and media", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <PostCard post={post()} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("3 likes")).toBeInTheDocument();
    expect(screen.getByAltText("A photo")).toBeInTheDocument();
  });

  it("toggles like and bookmark through mutations", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <PostCard post={post()} />
        </ToastProvider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Like" }));
    expect(likeMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Bookmark" }));
    expect(bookmarkMock).toHaveBeenCalledTimes(1);
  });

  it("shows liked state", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <PostCard post={post({ liked: true })} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Unlike" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
