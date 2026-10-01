import { fireEvent, render, screen } from "@testing-library/react";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import { describe, expect, it } from "vitest";
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
