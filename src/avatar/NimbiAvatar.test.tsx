import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NimbiAvatar } from "./NimbiAvatar";
import { NIMBI_CLOUDEE_DEFINITION } from "./cloudee-definition";

describe("NimbiAvatar", () => {
  it("renders Cloudee with the semantic behavior target", () => {
    render(
      <NimbiAvatar
        behavior="thinking"
        activity="thinking"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );

    const avatar = screen.getByRole("img", { name: "Nimbi: thinking" });
    expect(avatar).toHaveAttribute("data-avatar", "cloudee");
    expect(avatar).toHaveAttribute("data-behavior", "thinking");
    expect(avatar).toHaveAttribute("data-target", "animation:thinking");
  });

  it("does not change target when rerendered with the same behavior", () => {
    const view = render(
      <NimbiAvatar
        behavior="idle"
        activity="idle"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );
    const before = screen.getByRole("img", { name: "Nimbi: idle" }).getAttribute("data-target");
    view.rerender(
      <NimbiAvatar
        behavior="idle"
        activity="idle"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
      />,
    );
    expect(screen.getByRole("img", { name: "Nimbi: idle" }).getAttribute("data-target")).toBe(before);
  });

  it("uses the existing NimbiCloud as a safe fallback", () => {
    const broken = {
      ...NIMBI_CLOUDEE_DEFINITION,
      expressions: {},
      animations: {},
    };

    render(
      <NimbiAvatar
        behavior="working"
        activity="working"
        reducedMotion={false}
        passiveOpacity={0.72}
        interaction="passive"
        definition={broken}
      />,
    );

    expect(screen.getByTestId("nimbi-cloud")).toBeInTheDocument();
  });

  it("respects Presence opacity and reduced motion", () => {
    render(
      <NimbiAvatar
        behavior="idle"
        activity="idle"
        reducedMotion
        passiveOpacity={0.4}
        interaction="passive"
      />,
    );

    const avatar = screen.getByRole("img", { name: "Nimbi: idle" });
    expect(avatar).toHaveAttribute("data-motion", "reduced");
    expect(avatar).toHaveAttribute("data-effective-opacity", "0.4");
  });
});
