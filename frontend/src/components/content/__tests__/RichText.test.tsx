import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/content/RichText";

describe("RichText", () => {
  it("links hashtags and mentions while keeping other text", () => {
    render(
      <MemoryRouter>
        <RichText text="Hello #memories from @alice today" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "#memories" })).toHaveAttribute(
      "href",
      "/h/memories",
    );
    expect(screen.getByRole("link", { name: "@alice" })).toHaveAttribute(
      "href",
      "/u/alice",
    );
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });
});
