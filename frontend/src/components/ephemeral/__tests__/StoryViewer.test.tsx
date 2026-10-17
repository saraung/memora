import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { StoryViewer } from "@/components/ephemeral/StoryViewer";

const strangerStory = {
  id: "s9",
  caption: "Hello strangers",
  author: {
    id: "u9",
    username: "stranger",
    display_name: "Stranger",
    avatar_url: null,
    is_verified: false,
  },
  media: {
    id: "m9",
    resource_type: "image",
    format: "jpg",
    width: 100,
    height: 100,
    duration: null,
    secure_url: "https://example.com/s9.jpg",
  },
  viewed: false,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

const mockUseStory = vi.fn();

vi.mock("@/features/ephemeral/hooks", () => ({
  useStoryFeed: () => ({
    data: { pages: [{ items: [], has_more: false, next_cursor: null }] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useViewStory: () => ({ mutate: vi.fn() }),
  useStoryViewers: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDeleteStory: () => ({ mutate: vi.fn(), isPending: false }),
  useStory: (...args: unknown[]) => mockUseStory(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", username: "alice" } }),
}));

describe("StoryViewer", () => {
  it("renders a story that is not in the feed via direct fetch", () => {
    mockUseStory.mockReturnValue({
      data: strangerStory,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/stories/s9"]}>
        <ToastProvider>
          <Routes>
            <Route path="/stories/:storyId" element={<StoryViewer startStoryId="s9" />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByAltText("Hello strangers")).toBeInTheDocument();
    expect(screen.queryByText("Story not available")).not.toBeInTheDocument();
  });

  it("shows not-available only when the story truly cannot load", () => {
    mockUseStory.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/stories/gone"]}>
        <ToastProvider>
          <Routes>
            <Route path="/stories/:storyId" element={<StoryViewer startStoryId="gone" />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Story not available")).toBeInTheDocument();
  });
});
