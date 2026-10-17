import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import {
  ReportProvider,
  useReport,
} from "@/components/moderation/ReportDialog";

const submitReport = vi.fn().mockResolvedValue({ id: "rep1" });

vi.mock("@/services/endpoints/moderation", () => ({
  moderationApi: {
    submitReport: (...args: unknown[]) => submitReport(...args),
  },
}));

function Trigger() {
  const { openReport } = useReport();
  return (
    <button
      type="button"
      onClick={() =>
        openReport({ type: "post", id: "p1", label: "by @alice" })
      }
    >
      Open report
    </button>
  );
}

function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ReportProvider>
          <Trigger />
        </ReportProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("ReportDialog", () => {
  it("submits a report with the chosen category and details", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Open report" }));
    expect(
      screen.getByRole("dialog", { name: /report post/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /spam/i }));
    await user.type(
      screen.getByLabelText(/add details/i),
      "Looks like spam",
    );
    await user.click(screen.getByRole("button", { name: /submit report/i }));

    expect(submitReport).toHaveBeenCalledWith({
      target_type: "post",
      target_id: "p1",
      category: "spam",
      details: "Looks like spam",
    });
    expect(
      await screen.findByText(/report was submitted/i),
    ).toBeInTheDocument();
  });

  it("requires a category before submitting", async () => {
    const user = userEvent.setup();
    submitReport.mockClear();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Open report" }));
    const submit = screen.getByRole("button", { name: /submit report/i });
    expect(submit).toBeDisabled();
    expect(submitReport).not.toHaveBeenCalled();
  });
});
