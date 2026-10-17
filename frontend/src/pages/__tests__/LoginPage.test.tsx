import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { LoginPage } from "@/pages/LoginPage";

const loginMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText("Enter your email or username"),
    ).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("submits identifier and password, then navigates home", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ display_name: "Alice" });
    renderLogin();

    await user.type(
      screen.getByLabelText(/email or username/i),
      "alice@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "supersecret1");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        identifier: "alice@example.com",
        password: "supersecret1",
      });
    });
    expect(await screen.findByText("Home")).toBeInTheDocument();
  });

  it("shows server errors in an alert banner", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new Error("Invalid email or password"));
    renderLogin();

    await user.type(screen.getByLabelText(/email or username/i), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    // ApiError branch isn't hit for generic Errors; fallback message shows.
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Could not sign in");
  });
});
