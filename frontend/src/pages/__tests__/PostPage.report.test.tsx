import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ReportProvider } from "@/components/moderation/ReportDialog";
import { PostPage } from "@/pages/PostPage";

const post = {
  id: "p1",
  author: {
    id: "author-1",
    username: "alice",
    display_name: "Alice",
    avatar_url: null,
    is_verified: false,
    last_seen_at: null,
  },
  caption: "hello",
  media: [],
  like_count: 0,
  comment_count: 0,
  created_at: new Date().toISOString(),
};

let currentUserId = "viewer-1";

vi.mock("@/features/content/hooks", () => ({
  usePost: () => ({ data: post, isPending: false, isError: false, error: null }),
  useDeletePost: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: currentUserId } }),
}));

vi.mock("@/components/content/PostCard", () => ({
  PostCard: () => <div data-testid="post-card" />,
}));

vi.mock("@/components/content/Comments", () => ({
  CommentSection: () => <div data-testid="comments" />,
}));

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ReportProvider>
          <MemoryRouter initialEntries={["/p/p1"]}>
            <Routes>
              <Route path="/p/:postId" element={<PostPage />} />
            </Routes>
          </MemoryRouter>
        </ReportProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("PostPage actions menu", () => {
  it("offers Report for someone else's post", async () => {
    currentUserId = "viewer-1";
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /post actions/i }));
    expect(
      screen.getByRole("menuitem", { name: /report post/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /delete post/i })).toBeNull();
  });

  it("offers Delete for your own post", async () => {
    currentUserId = "author-1";
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /post actions/i }));
    expect(
      screen.getByRole("menuitem", { name: /delete post/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /report post/i })).toBeNull();
  });
});
