import { describe, expect, it } from "vitest";
import {
  CompletionLatch,
  baselineBehavior,
  resolveBehavior,
} from "./nimbi-behavior-controller";

describe("Nimbi behavior controller", () => {
  it("maps telemetry into a calm baseline", () => {
    expect(baselineBehavior("idle", false)).toBe("idle");
    expect(baselineBehavior("idle", true)).toBe("listening");
    expect(baselineBehavior("thinking", false)).toBe("thinking");
    expect(baselineBehavior("working", false)).toBe("working");
    expect(baselineBehavior("needs-input", false)).toBe("needs-input");
    expect(baselineBehavior("error", false)).toBe("error");
    expect(baselineBehavior("offline", false)).toBe("idle");
    expect(baselineBehavior("complete", false)).toBe("idle");
  });

  it("gives direct manipulation priority over ambient and system behavior", () => {
    expect(
      resolveBehavior({
        baseline: "working",
        hovered: true,
        interaction: "dragging",
      }),
    ).toBe("dragging");

    expect(
      resolveBehavior({
        baseline: "needs-input",
        hovered: true,
        interaction: "grab",
      }),
    ).toBe("grab");
  });

  it("lets tap and release override the current baseline but not active drag", () => {
    expect(
      resolveBehavior({
        baseline: "error",
        hovered: false,
        interaction: "tap",
      }),
    ).toBe("tap");

    expect(
      resolveBehavior({
        baseline: "working",
        hovered: false,
        interaction: "release",
      }),
    ).toBe("release");

    expect(
      resolveBehavior({
        baseline: "working",
        hovered: false,
        interaction: "dragging",
        transient: "tap",
      }),
    ).toBe("dragging");
  });

  it("uses notice only when no higher-priority behavior is active", () => {
    expect(resolveBehavior({ baseline: "idle", hovered: true })).toBe("notice");
    expect(resolveBehavior({ baseline: "thinking", hovered: true })).toBe("thinking");
    expect(resolveBehavior({ baseline: "needs-input", hovered: true })).toBe("needs-input");
  });

  it("emits completion once per transition into complete", () => {
    const latch = new CompletionLatch();

    expect(latch.update("working")).toBe(false);
    expect(latch.update("complete")).toBe(true);
    expect(latch.update("complete")).toBe(false);
    expect(latch.update("idle")).toBe(false);
    expect(latch.update("complete")).toBe(true);
  });

  it("recomputes the current baseline after transient reactions", () => {
    expect(
      resolveBehavior({
        baseline: baselineBehavior("working", false),
        hovered: false,
      }),
    ).toBe("working");

    expect(
      resolveBehavior({
        baseline: baselineBehavior("idle", true),
        hovered: false,
      }),
    ).toBe("listening");
  });

  it("resolves rapid state churn deterministically", () => {
    const latch = new CompletionLatch();

    expect(resolveBehavior({ baseline: baselineBehavior("thinking", false) })).toBe("thinking");
    expect(resolveBehavior({ baseline: baselineBehavior("working", false) })).toBe("working");

    expect(latch.update("complete")).toBe(true);
    expect(
      resolveBehavior({
        baseline: baselineBehavior("complete", false),
        transient: "complete",
      }),
    ).toBe("complete");

    expect(latch.update("idle")).toBe(false);
    expect(resolveBehavior({ baseline: baselineBehavior("idle", false) })).toBe("idle");
  });
});
