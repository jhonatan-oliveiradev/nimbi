import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NimbiCloud } from "./NimbiCloud";

describe("NimbiCloud", () => {
  it("renders an original cloud with exactly two eyes and no mouth", () => {
    const { container } = render(<NimbiCloud activity="idle" />);
    expect(screen.getByTestId("nimbi-cloud")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-nimbi-eye]")).toHaveLength(2);
    expect(container.querySelector("[data-nimbi-mouth]")).toBeNull();
  });

  it("exposes reduced motion without losing semantic state", () => {
    render(<NimbiCloud activity="working" reducedMotion />);
    const cloud = screen.getByTestId("nimbi-cloud");
    expect(cloud).toHaveAttribute("data-motion", "reduced");
    expect(cloud).toHaveAttribute("data-activity", "working");
  });

  it("disables pointer gaze while hidden", () => {
    render(
      <NimbiCloud
        activity="idle"
        hidden
        pointer={{ x: 500, y: 0 }}
        bounds={{ x: 0, y: 0, width: 100, height: 60 }}
      />,
    );
    const cloud = screen.getByTestId("nimbi-cloud");
    expect(cloud).toHaveAttribute("data-gaze-x", "0");
    expect(cloud).toHaveAttribute("data-gaze-y", "0");
  });

  it("marks complete as a one-shot reaction rather than a looping state", () => {
    render(<NimbiCloud activity="complete" />);
    const cloud = screen.getByTestId("nimbi-cloud");
    expect(cloud).toHaveAttribute("data-reaction", "complete");
    expect(cloud).toHaveAttribute("data-looping", "false");
  });

  it("keeps offline inspectable", () => {
    render(<NimbiCloud activity="offline" />);
    expect(screen.getByTestId("nimbi-cloud")).toHaveAttribute(
      "data-activity",
      "offline",
    );
  });
});
