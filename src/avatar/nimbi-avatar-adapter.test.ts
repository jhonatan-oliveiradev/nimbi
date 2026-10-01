import { describe, expect, it } from "vitest";
import {
  safeTargetForBehavior,
  targetForBehavior,
} from "./nimbi-avatar-adapter";
import { NIMBI_CLOUDEE_DEFINITION } from "./cloudee-definition";

describe("Nimbi avatar adapter", () => {
  it("maps semantic behaviors to Cloudee targets", () => {
    expect(targetForBehavior("idle", false)).toEqual({ kind: "animation", key: "idle" });
    expect(targetForBehavior("listening", false)).toEqual({ kind: "animation", key: "listening" });
    expect(targetForBehavior("thinking", false)).toEqual({ kind: "animation", key: "thinking" });
    expect(targetForBehavior("searching", false)).toEqual({ kind: "animation", key: "searching" });
    expect(targetForBehavior("working", false)).toEqual({ kind: "animation", key: "working" });
    expect(targetForBehavior("complete", false)).toEqual({ kind: "animation", key: "celebrate" });
    expect(targetForBehavior("notice", false)).toEqual({ kind: "animation", key: "curious" });
    expect(targetForBehavior("needs-input", false)).toEqual({ kind: "expression", key: "small-attentive" });
    expect(targetForBehavior("error", false)).toEqual({ kind: "animation", key: "confused" });
    expect(targetForBehavior("tap", false)).toEqual({ kind: "animation", key: "playful" });
  });

  it("uses restrained direct expressions for manipulation", () => {
    expect(targetForBehavior("grab", false)).toEqual({ kind: "expression", key: "surprised-left" });
    expect(targetForBehavior("dragging", false)).toEqual({ kind: "expression", key: "attentive-left" });
    expect(targetForBehavior("release", false)).toEqual({ kind: "expression", key: "playful-right" });
  });

  it("uses non-looping expression feedback under reduced motion", () => {
    expect(targetForBehavior("complete", true).kind).toBe("expression");
    expect(targetForBehavior("tap", true).kind).toBe("expression");
    expect(targetForBehavior("release", true).kind).toBe("expression");
  });

  it("falls back safely when a configured key is absent", () => {
    const broken = {
      ...NIMBI_CLOUDEE_DEFINITION,
      animations: {},
      expressions: { neutral: NIMBI_CLOUDEE_DEFINITION.expressions.neutral },
    };
    expect(safeTargetForBehavior("working", false, broken)).toEqual({
      kind: "expression",
      key: "neutral",
    });
  });
});
