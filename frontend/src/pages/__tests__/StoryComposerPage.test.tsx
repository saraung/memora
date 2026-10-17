import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { StoryComposerPage } from "@/pages/StoryComposerPage";

const mutateMock = vi.fn();

vi.mock("@/features/ephemeral/hooks", () => ({
  usePublishStory: () => ({ mutate: mutateMock, isPending: false }),
}));

describe("StoryComposerPage", () => {
  it("keeps publishing disabled until media is chosen", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <StoryComposerPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /share story/i }),
    ).toBeDisabled();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
