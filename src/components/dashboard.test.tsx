import axe from "axe-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { generateTickets } from "@/lib/analytics";

import Dashboard from "./dashboard";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("Dashboard", () => {
  it("exposes labelled filters, sortable evidence, and keyboard-native pagination", () => {
    render(<Dashboard initialRecords={generateTickets(80, 7)} />);

    expect(screen.getByLabelText("Period")).toBeInTheDocument();
    expect(screen.getByLabelText("Team")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /synthetic support tickets/i })).toBeInTheDocument();

    const dateHeader = screen.getByRole("columnheader", { name: /date/i });
    expect(dateHeader).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(screen.getByRole("button", { name: /date/i }));
    expect(dateHeader).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("has no automated accessibility violations in the primary experience", async () => {
    const { container } = render(<Dashboard initialRecords={generateTickets(80, 9)} />);
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(result.violations).toEqual([]);
  });

  it("renders a recoverable error state", () => {
    render(<Dashboard initialError="generation failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be prepared/i);
    expect(screen.getByRole("button", { name: /retry generation/i })).toBeInTheDocument();
  });
});
