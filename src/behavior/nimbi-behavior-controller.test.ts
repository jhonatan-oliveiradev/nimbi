import { describe, expect, it } from "vitest";
import {
  CompletionLatch,
  baselineBehavior,
  resolveBehavior,
} from "./nimbi-behavior-controller";

describe("Nimbi behavior controller", () => {
  it("maps baseline semantic states", () => {
    expect(baselineBehavior("idle", false)).toBe("idle");
    expect(baselineBehavior("idle", true)).toBe("listening");
    expect(baselineBehavior("thinking", false)).toBe("thinking");
    expect(baselineBehavior("working", true)).toBe("working");
    expect(baselineBehavior("complete", false)).toBe("idle");
    expect(baselineBehavior("needs-input", false)).toBe("needs-input");
    expect(baselineBehavior("error", false)).toBe("error");
    expect(baselineBehavior("offline", false)).toBe("idle");
  });

  it("resolves interaction priority deterministically", () => {
    expect(resolveBehavior({ baseline: "working", notice: true })).toBe("working");
    expect(resolveBehavior({ baseline: "thinking", needsInput: true, error: true })).toBe("needs-input");
    expect(resolveBehavior({ baseline: "working", transient: "tap" })).toBe("tap");
    expect(resolveBehavior({ baseline: "error", transient: "release" })).toBe("release");
    expect(resolveBehavior({ baseline: "needs-input", notice: true, dragging: true })).toBe("dragging");
    expect(resolveBehavior({ baseline: "working", grab: true, transient: "tap" })).toBe("grab");
  });

  it("returns to the current baseline after transients", () => {
    expect(resolveBehavior({ baseline: "thinking", transient: undefined })).toBe("thinking");
    expect(resolveBehavior({ baseline: "working", transient: undefined })).toBe("working");
  });

  it("emits completion only on entry into complete", () => {
    const latch = new CompletionLatch();
    expect(latch.update("working")).toBe(false);
    expect(latch.update("complete")).toBe(true);
    expect(latch.update("complete")).toBe(false);
    expect(latch.update("idle")).toBe(false);
    expect(latch.update("complete")).toBe(true);
  });

  it("handles rapid state churn", () => {
    const latch = new CompletionLatch();
    const activities = ["thinking", "working", "complete", "idle"] as const;
    expect(activities.map((activity) => ({
      baseline: baselineBehavior(activity, false),
      completion: latch.update(activity),
    }))).toEqual([
      { baseline: "thinking", completion: false },
      { baseline: "working", completion: false },
      { baseline: "idle", completion: true },
      { baseline: "idle", completion: false },
    ]);
  });
});
