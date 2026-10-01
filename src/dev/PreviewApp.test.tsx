import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviewApp } from "./PreviewApp";

describe("PreviewApp", () => {
  it("uses production placement state and exposes Presence controls", () => {
    render(<PreviewApp />);

    expect(screen.getByText(/top · 50% · 72%/i)).toBeInTheDocument();
    expect(document.querySelector(".nimbi-placement-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("nimbi-island"));

    const slider = screen.getByRole("slider", { name: "Nimbi opacity" });
    fireEvent.click(slider);
    expect(screen.getByRole("slider", { name: "Nimbi opacity" })).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "38" } });

    expect(screen.getByText(/top · 50% · 38%/i)).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-avatar")).toHaveAttribute(
      "data-effective-opacity",
      "0.38",
    );
  });
});
