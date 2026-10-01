import { describe, expect, it } from "vitest";
import { effectiveOpacity } from "./presence";

describe("effectiveOpacity", () => {
  it("clamps the configured passive opacity to 20–100 percent", () => {
    expect(effectiveOpacity("idle", 0.05, "passive")).toBe(0.2);
    expect(effectiveOpacity("idle", 1.4, "passive")).toBe(1);
  });

  it("preserves the semantic minimum for each active state", () => {
    expect(effectiveOpacity("idle", 0.3, "passive")).toBe(0.3);
    expect(effectiveOpacity("thinking", 0.3, "passive")).toBe(0.55);
    expect(effectiveOpacity("working", 0.3, "passive")).toBe(0.65);
    expect(effectiveOpacity("complete", 0.3, "passive")).toBe(0.75);
    expect(effectiveOpacity("error", 0.3, "passive")).toBe(0.9);
  });

  it("keeps needs-input fully visible regardless of preference", () => {
    expect(effectiveOpacity("needs-input", 0.2, "passive")).toBe(1);
  });

  it("raises Nimbi to full opacity while hovered or dragged", () => {
    expect(effectiveOpacity("idle", 0.2, "hover")).toBe(1);
    expect(effectiveOpacity("offline", 0.2, "drag")).toBe(1);
  });

  it("uses passive preference for offline presence", () => {
    expect(effectiveOpacity("offline", 0.44, "passive")).toBe(0.44);
  });
});
