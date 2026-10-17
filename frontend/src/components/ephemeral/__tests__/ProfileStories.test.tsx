import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ProfileStories } from "@/components/ephemeral/ProfileStories";

const mockUseUserStories = vi.fn();

vi.mock("@/features/ephemeral/hooks", () => ({
  useUserStories: (...args: unknown[]) => mockUseUserStories(...args),
}));

function story(id: string) {
  return {
    id,
    caption: null,
    author: {
      id: "u1",
      username: "bob",
      display_name: "Bob",
      avatar_url: null,
      is_verified: false,
    },
    media: {
      id: "m1",
      resource_type: "image",
      format: "jpg",
      width: 100,
      height: 100,
      duration: null,
      secure_url: "https://example.com/s.jpg",
    },
    viewed: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  };
}

describe("ProfileStories", () => {
  it("renders nothing when the profile has no stories", () => {
    mockUseUserStories.mockReturnValue({
      data: { pages: [{ items: [] }] },
      isPending: false,
      isError: false,
    });
    render(
      <MemoryRouter>
        <ToastProvider>
          <ProfileStories username="bob" />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("link", { name: /story from/i }),
    ).not.toBeInTheDocument();
  });

  it("links each story into the viewer", () => {
    mockUseUserStories.mockReturnValue({
      data: { pages: [{ items: [story("s1"), story("s2")] }] },
      isPending: false,
      isError: false,
    });
    render(
      <MemoryRouter>
        <ToastProvider>
          <ProfileStories username="bob" />
        </ToastProvider>
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link", { name: /story from/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/stories/s1");
  });
});
