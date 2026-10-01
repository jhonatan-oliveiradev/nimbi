import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviewApp } from "./PreviewApp";

describe("PreviewApp", () => {
  it("uses production placement state and exposes Presence controls", async () => {
    render(<PreviewApp />);

    expect(screen.getByText(/top · 50% · 72%/i)).toBeInTheDocument();
    expect(document.querySelector(".nimbi-placement-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("nimbi-island"));

    const slider = await screen.findByRole("slider", { name: "Nimbi opacity" });
    fireEvent.click(slider);
    expect(screen.getByRole("slider", { name: "Nimbi opacity" })).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "38" } });

    expect(screen.getByText(/top · 50% · 38%/i)).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-avatar")).toHaveAttribute(
      "data-effective-opacity",
      "0.38",
    );
  });

  it("offers deterministic placement fixtures for visual review", () => {
    render(<PreviewApp />);

    fireEvent.click(screen.getByRole("button", { name: "Dock right" }));
    expect(screen.getByText(/right · 50% · 72%/i)).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-island")).toHaveAttribute("data-edge", "right");

    fireEvent.click(screen.getByRole("button", { name: "Float bottom right" }));
    expect(screen.getByText(/floating · 92% \/ 90% · 72%/i)).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-island")).toHaveAttribute(
      "data-edge",
      "floating",
    );
  });
});
