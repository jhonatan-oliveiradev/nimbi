import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import { DynamicIsland } from "./DynamicIsland";
import type { IslandMode } from "./island-machine";

describe("DynamicIsland", () => {
  it("keeps idle minimal with no dashboard metrics", () => {
    const { container } = render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode="idle" />,
    );

    expect(screen.getByTestId("nimbi-cloud")).toBeInTheDocument();
    expect(screen.queryByTestId("nimbi-status")).toBeNull();
    expect(container.querySelector("[data-metric]")).toBeNull();
  });

  it("shows one concise status line while working", () => {
    render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.working} mode="compact" />,
    );

    expect(screen.getByTestId("nimbi-status")).toHaveTextContent(
      "Codex is working",
    );
  });

  it("renders attribution only when it is known", () => {
    const snapshot = {
      ...NIMBI_FIXTURES.working,
      provider: undefined,
      model: undefined,
      project: undefined,
    };
    render(<DynamicIsland snapshot={snapshot} mode="compact" />);

    expect(screen.queryByTestId("nimbi-meta")).toBeNull();
  });

  it("marks preview attention UI as fixture-only", () => {
    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES["needs-input"]}
        mode="attention"
        fixtureOnly
      />,
    );

    const attention = screen.getByTestId("nimbi-attention");
    expect(attention).toHaveAttribute("data-fixture-only", "true");
    expect(attention).toHaveTextContent("Claude needs your attention");
  });

  it("keeps offline muted without opening an alert", () => {
    render(
      <DynamicIsland snapshot={NIMBI_FIXTURES.offline} mode="idle" />,
    );

    const shell = screen.getByTestId("nimbi-island");
    expect(shell).toHaveAttribute("data-muted", "true");
    expect(screen.queryByTestId("nimbi-attention")).toBeNull();
  });

  it("feeds pointer movement into the Nimbi character", () => {
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 242,
      y: 0,
      width: 156,
      height: 40,
      top: 0,
      right: 398,
      bottom: 40,
      left: 242,
      toJSON: () => ({}),
    } as DOMRect);

    render(<DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode="idle" />);
    fireEvent.pointerMove(screen.getByTestId("nimbi-island"), {
      clientX: 390,
      clientY: 20,
    });

    expect(screen.getByTestId("nimbi-cloud")).not.toHaveAttribute(
      "data-gaze-x",
      "0",
    );
    rectSpy.mockRestore();
  });

  it("reports rendered island bounds to the native shell", () => {
    const onBoundsChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 242,
      y: 0,
      width: 156,
      height: 40,
      top: 0,
      right: 398,
      bottom: 40,
      left: 242,
      toJSON: () => ({}),
    } as DOMRect);

    render(
      <DynamicIsland
        snapshot={NIMBI_FIXTURES.idle}
        mode="idle"
        onBoundsChange={onBoundsChange}
      />,
    );

    expect(onBoundsChange).toHaveBeenCalledWith({
      x: 242,
      y: 0,
      width: 156,
      height: 40,
    });
    rectSpy.mockRestore();
  });

  it.each<IslandMode>([
    "hidden",
    "idle",
    "compact",
    "attention",
    "expanded",
  ])("exposes the %s shell mode", (mode) => {
    render(<DynamicIsland snapshot={NIMBI_FIXTURES.idle} mode={mode} />);
    expect(screen.getByTestId("nimbi-island")).toHaveAttribute(
      "data-mode",
      mode,
    );
  });
});
