import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { NotificationsPage } from "@/pages/NotificationsPage";
import type { NotificationItem } from "@/types/chat";

const markAllMock = vi.fn();
const state = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock("@/features/notifications/hooks", () => ({
  useNotifications: () => ({
    data: { pages: [{ items: state.items }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetching: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({
    mutate: markAllMock,
    isPending: false,
  }),
}));

function notification(
  overrides: Partial<NotificationItem> &
    Pick<NotificationItem, "id" | "type">,
): NotificationItem {
  return {
    actor: {
      id: "u2",
      username: "bob",
      display_name: "Bob",
      avatar_url: null,
      is_verified: false,
      last_seen_at: null,
    },
    target_type: null,
    target_id: null,
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  } as NotificationItem;
}

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <NotificationsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("NotificationsPage", () => {
  it("renders a meaningful sentence and marks all read", async () => {
    const user = userEvent.setup();
    state.items = [
      notification({ id: "n1", type: "follow", target_type: "user" }),
    ];
    renderPage();
    expect(screen.getByText(/Bob started following you/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /mark all read/i }));
    expect(markAllMock).toHaveBeenCalledTimes(1);
  });

  it("aggregates likes on the same post into one row", () => {
    state.items = [
      notification({
        id: "n1",
        type: "like",
        target_type: "post",
        target_id: "p1",
      }),
      notification({
        id: "n2",
        type: "like",
        target_type: "post",
        target_id: "p1",
        actor: {
          id: "u3",
          username: "carol",
          display_name: "Carol",
          avatar_url: null,
          is_verified: false,
          last_seen_at: null,
        },
      }),
    ];
    renderPage();
    expect(screen.getAllByText(/liked your post/)).toHaveLength(1);
    expect(
      screen.getByText(/Bob and 1 other liked your post/),
    ).toBeInTheDocument();
  });

  it("gives calls a real sentence instead of a generic notice", () => {
    state.items = [
      notification({
        id: "n1",
        type: "call",
        target_type: "conversation",
        target_id: "c1",
      }),
    ];
    renderPage();
    expect(screen.queryByText(/sent you a notification/)).not.toBeInTheDocument();
    expect(screen.getByText(/Bob called you/)).toBeInTheDocument();
  });

  it("counts repeated messages from the same person", () => {
    state.items = [
      notification({
        id: "n1",
        type: "message",
        target_type: "conversation",
        target_id: "c1",
      }),
      notification({
        id: "n2",
        type: "message",
        target_type: "conversation",
        target_id: "c1",
      }),
    ];
    renderPage();
    expect(screen.getByText(/Bob sent you 2 messages/)).toBeInTheDocument();
  });
});
