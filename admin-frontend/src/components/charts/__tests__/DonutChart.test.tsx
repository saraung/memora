import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DonutChart } from "@/components/charts/DonutChart";

describe("DonutChart", () => {
  it("renders the total and a labelled legend with counts", () => {
    render(
      <DonutChart
        centerLabel="Reports"
        data={[
          { key: "pending", count: 3 },
          { key: "dismissed", count: 1 },
        ]}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("dismissed")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("shows an empty message when there is no data", () => {
    render(<DonutChart centerLabel="Reports" data={[]} />);
    expect(screen.getByText("No data yet.")).toBeInTheDocument();
  });
});
