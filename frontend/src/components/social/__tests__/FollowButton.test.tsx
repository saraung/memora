import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { FollowButton } from "@/components/social/FollowButton";
import type { Profile } from "@/types/social";

const mutateMock = vi.fn();

vi.mock("@/features/social/hooks", () => ({
  useFollowToggle: () => ({ mutate: mutateMock, isPending: false }),
}));

function profile(relationship: Profile["relationship"]): Profile {
  return {
    id: "user-1",
    username: "bob",
    display_name: "Bob",
    avatar_url: null,
    is_verified: false,
    bio: null,
    links: null,
    is_private: false,
    account_status: "active",
    follower_count: 0,
    following_count: 0,
    relationship,
    created_at: new Date().toISOString(),
  };
}

describe("FollowButton", () => {
  beforeEach(() => mutateMock.mockReset());

  it.each([
    ["none", "Follow"],
    ["requested", "Requested"],
    ["following", "Following"],
  ] as const)("shows %s state", (relationship, label) => {
    render(
      <ToastProvider>
        <FollowButton profile={profile(relationship)} />
      </ToastProvider>,
    );
    expect(
      screen.getByRole("button", { name: new RegExp(label, "i") }),
    ).toBeInTheDocument();
  });

  it("follows immediately when there is no relationship", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <FollowButton profile={profile("none")} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /follow/i }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation before unfollowing", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <FollowButton profile={profile("following")} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /following/i }));
    expect(mutateMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^unfollow$/i }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });
});
