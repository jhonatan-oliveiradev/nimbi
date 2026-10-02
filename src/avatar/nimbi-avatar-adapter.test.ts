import { describe, expect, it } from "vitest";
import { NIMBI_CLOUDEE_DEFINITION } from "./cloudee-definition";
import {
  safeTargetForBehavior,
  targetForBehavior,
} from "./nimbi-avatar-adapter";

describe("Nimbi avatar adapter", () => {
  it.each([
    ["idle", { kind: "animation", key: "idle" }],
    ["listening", { kind: "animation", key: "listening" }],
    ["thinking", { kind: "animation", key: "thinking" }],
    ["searching", { kind: "animation", key: "searching" }],
    ["working", { kind: "animation", key: "working" }],
    ["complete", { kind: "animation", key: "celebrate" }],
    ["notice", { kind: "animation", key: "curious" }],
    ["needs-input", { kind: "expression", key: "attentive-left" }],
    ["error", { kind: "expression", key: "uneasy-left" }],
    ["tap", { kind: "animation", key: "playful" }],
    ["grab", { kind: "expression", key: "small-attentive" }],
    ["dragging", { kind: "expression", key: "attentive-left" }],
    ["release", { kind: "expression", key: "joyful-down-right" }],
  ] as const)("maps %s to a Cloudee target", (behavior, expected) => {
    expect(targetForBehavior(behavior, false)).toEqual(expected);
  });

  it("uses static expressions for every reduced-motion behavior", () => {
    for (const behavior of [
      "idle",
      "notice",
      "listening",
      "thinking",
      "searching",
      "working",
      "complete",
      "needs-input",
      "error",
      "tap",
      "grab",
      "dragging",
      "release",
    ] as const) {
      expect(targetForBehavior(behavior, true).kind).toBe("expression");
    }

    expect(targetForBehavior("tap", true)).toEqual({
      kind: "expression",
      key: "playful-right",
    });
    expect(targetForBehavior("release", true)).toEqual({
      kind: "expression",
      key: "gentle-downward-gaze",
    });
    expect(targetForBehavior("complete", true)).toEqual({
      kind: "expression",
      key: "joyful-wide",
    });

    for (const behavior of [
      "idle",
      "notice",
      "listening",
      "thinking",
      "searching",
      "working",
      "complete",
      "needs-input",
      "error",
      "tap",
      "grab",
      "dragging",
      "release",
    ] as const) {
      const target = targetForBehavior(behavior, true);
      if (target.kind !== "expression") throw new Error("reduced target must be an expression");
      expect(NIMBI_CLOUDEE_DEFINITION.expressions[target.key]?.motion).toEqual({
        eyes: "none",
        body: "none",
      });
    }
  });

  it("keeps every configured target valid for the shipped Cloudee definition", () => {
    for (const behavior of [
      "idle",
      "notice",
      "listening",
      "thinking",
      "searching",
      "working",
      "complete",
      "needs-input",
      "error",
      "tap",
      "grab",
      "dragging",
      "release",
    ] as const) {
      expect(safeTargetForBehavior(behavior, false)).toEqual(
        targetForBehavior(behavior, false),
      );
      expect(safeTargetForBehavior(behavior, true)).toEqual(
        targetForBehavior(behavior, true),
      );
    }
  });

  it("falls back to idle when an animation target is missing", () => {
    const definition = {
      ...NIMBI_CLOUDEE_DEFINITION,
      animations: {
        idle: NIMBI_CLOUDEE_DEFINITION.animations.idle,
      },
    };

    expect(safeTargetForBehavior("working", false, definition)).toEqual({
      kind: "animation",
      key: "idle",
    });
  });

  it("falls back to neutral when an expression target is missing", () => {
    const definition = {
      ...NIMBI_CLOUDEE_DEFINITION,
      expressions: {
        neutral: NIMBI_CLOUDEE_DEFINITION.expressions.neutral,
      },
    };

    expect(safeTargetForBehavior("error", false, definition)).toEqual({
      kind: "expression",
      key: "neutral",
    });
  });
});
