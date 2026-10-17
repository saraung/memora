import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ComposePage } from "@/pages/ComposePage";

const mutateMock = vi.fn();

vi.mock("@/features/content/hooks", () => ({
  useCreatePost: () => ({ mutate: mutateMock, isPending: false }),
}));

describe("ComposePage", () => {
  it("keeps publishing disabled until media is added", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ComposePage />
        </ToastProvider>
      </MemoryRouter>,
    );
    const share = screen.getByRole("button", { name: /share post/i });
    expect(share).toBeDisabled();
    await user.click(share);
    expect(mutateMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /choose photos or videos/i }),
    ).toBeInTheDocument();
  });

  it("renders the picker and caption box", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <ComposePage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /choose photos or videos/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
  });
});
