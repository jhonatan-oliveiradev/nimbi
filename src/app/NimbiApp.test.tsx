import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import { describe, expect, it, vi } from "vitest";
import { NimbiApp } from "./NimbiApp";

describe("NimbiApp", () => {
  it("renders the semantic Nimbi island shell", () => {
    render(<NimbiApp />);
    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAccessibleName("Nimbi");
  });

  it("feeds semantic behavior and hover notice into the island", () => {
    render(
      <NimbiApp snapshot={NIMBI_FIXTURES.idle} mode="idle" reducedMotion />,
    );

    const island = screen.getByTestId("nimbi-island");
    expect(island).toHaveAttribute("data-behavior", "idle");

    fireEvent.pointerEnter(island);
    expect(island).toHaveAttribute("data-behavior", "notice");
  });

  it("opens the general composer when idle Nimbi is clicked", () => {
    render(<NimbiApp snapshot={NIMBI_FIXTURES.idle} reducedMotion />);

    fireEvent.click(screen.getByTestId("nimbi-island"));

    expect(screen.getByRole("textbox", { name: "Ask Nimbi" })).toBeInTheDocument();
    expect(screen.getByTestId("nimbi-avatar")).toBeInTheDocument();
  });

  it("submits the idle composer through the injected action client", async () => {
    const actionSubmit = vi.fn().mockResolvedValue({
      accepted: true,
      response: "Build started.",
    });
    render(
      <NimbiApp
        snapshot={NIMBI_FIXTURES.idle}
        reducedMotion
        actionSubmit={actionSubmit}
      />,
    );

    fireEvent.click(screen.getByTestId("nimbi-island"));
    const input = screen.getByRole("textbox", { name: "Ask Nimbi" });
    fireEvent.change(input, { target: { value: "check build" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(actionSubmit).toHaveBeenCalledWith({
        type: "prompt",
        text: "check build",
      }),
    );
    expect(await screen.findByText("Build started.")).toBeInTheDocument();
  });

  it("keeps real needs-input attention ahead of a short action response", async () => {
    const actionSubmit = vi.fn().mockResolvedValue({
      accepted: true,
      response: "Starting.",
    });
    const { rerender } = render(
      <NimbiApp
        snapshot={NIMBI_FIXTURES.idle}
        reducedMotion
        actionSubmit={actionSubmit}
      />,
    );

    fireEvent.click(screen.getByTestId("nimbi-island"));
    const input = screen.getByRole("textbox", { name: "Ask Nimbi" });
    fireEvent.change(input, { target: { value: "work" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Starting.")).toBeInTheDocument();

    rerender(
      <NimbiApp
        snapshot={NIMBI_FIXTURES["needs-input"]}
        reducedMotion
        actionSubmit={actionSubmit}
      />,
    );

    expect(await screen.findByText("Claude needs your attention")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply to Claude" })).toBeInTheDocument();
    expect(screen.queryByText("Starting.")).toBeNull();
  });

  it("uses listening as the idle baseline while expanded", () => {
    render(
      <NimbiApp snapshot={NIMBI_FIXTURES.idle} mode="expanded" reducedMotion />,
    );

    expect(screen.getByTestId("nimbi-island")).toHaveAttribute(
      "data-behavior",
      "listening",
    );
  });
});