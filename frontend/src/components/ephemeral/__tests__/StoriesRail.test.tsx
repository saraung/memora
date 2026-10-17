import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { StoriesRail } from "@/components/ephemeral/StoriesRail";
import { useAuth } from "@/hooks/useAuth";
import { useStoryFeed } from "@/features/ephemeral/hooks";

vi.mock("@/features/ephemeral/hooks", () => ({
  useStoryFeed: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockFeed = useStoryFeed as unknown as Mock;
const mockAuth = useAuth as unknown as Mock;

function setup(feed: unknown) {
  mockAuth.mockReturnValue({
    user: { id: "u1", username: "alice", display_name: "Alice" },
  });
  mockFeed.mockReturnValue(feed);
  return render(
    <MemoryRouter>
      <ToastProvider>
        <StoriesRail />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("StoriesRail", () => {
  it("stays visible with an empty hint when nobody has stories", () => {
    setup({ data: { pages: [] }, isPending: false, isError: false });
    expect(
      screen.getByRole("listitem", { name: /add to your story/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no stories yet/i)).toBeInTheDocument();
  });

  it("lists author rings when stories exist and hides the hint", () => {
    setup({
      data: {
        pages: [
          {
            items: [
              {
                author: {
                  id: "u2",
                  username: "bob",
                  display_name: "Bob",
                  avatar_url: null,
                },
                stories: [
                  {
                    id: "s1",
                    viewed: false,
                    media: { resource_type: "image", secure_url: "" },
                  },
                ],
                has_unseen: true,
              },
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    expect(
      screen.getByRole("listitem", { name: /bob's story/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no stories yet/i)).not.toBeInTheDocument();
  });
});
