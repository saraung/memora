import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ChatPanel } from "@/components/chat/ChatPanel";

const sendMock = vi.fn();
const uploadAllMock = vi.fn().mockResolvedValue(["asset-1"]);

vi.mock("@/features/chat/hooks", () => ({
  useMessages: () => ({
    data: { pages: [{ items: [] }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useSendMessage: () => ({ mutate: sendMock, isPending: false }),
  useMarkRead: () => ({ mutate: vi.fn() }),
  useDeleteConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useAttachments: () => ({
    items: [],
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    uploading: false,
    uploadAll: uploadAllMock,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", username: "alice" } }),
}));

function renderPanel() {
  const client = new QueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ChatPanel conversationId="conv-1" otherUsername="bob" />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ChatPanel", () => {
  it("sends text with no attachments", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText("Message"), "hello there");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(uploadAllMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(
      { body: "hello there", mediaIds: ["asset-1"] },
      expect.anything(),
    );
  });

  it("shows an attach button", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /attach images/i }),
    ).toBeInTheDocument();
  });
});
