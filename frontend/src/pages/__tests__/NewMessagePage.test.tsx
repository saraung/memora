import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { NewMessagePage } from "@/pages/NewMessagePage";

const startMock = vi.fn();

vi.mock("@/features/chat/hooks", () => ({
  useStartDirectMessage: () => ({ mutate: startMock, isPending: false }),
  useAttachments: () => ({
    items: [],
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    uploading: false,
    uploadAll: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("@/features/social/hooks", () => ({
  useProfile: () => ({
    data: {
      id: "u2",
      username: "bob",
      display_name: "Bob",
      avatar_url: null,
      is_verified: false,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("NewMessagePage", () => {
  it("sends nothing until the user writes and submits", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/messages/new/bob"]}>
        <ToastProvider>
          <Routes>
            <Route path="/messages/new/:username" element={<NewMessagePage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/nothing is shared until you send/i),
    ).toBeInTheDocument();
    expect(startMock).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Message"), "Hello Bob");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith(
      { participantId: "u2", body: "Hello Bob", mediaIds: [] },
      expect.anything(),
    );
  });
});
