import { describe, expect, it } from "vitest";
import type { NimbiActivity } from "../telemetry/contract";
import { clampGaze, motionForActivity } from "./nimbi-motion";

const states: NimbiActivity[] = [
  "offline",
  "idle",
  "thinking",
  "working",
  "needs-input",
  "complete",
  "error",
];

describe("Nimbi motion grammar", () => {
  it("maps every activity to all motion parameters", () => {
    for (const state of states) {
      const motion = motionForActivity(state);
      expect(Object.keys(motion).sort()).toEqual(
        [
          "energy",
          "focus",
          "urgency",
          "stretchX",
          "stretchY",
          "tilt",
          "gazeX",
          "gazeY",
          "opacity",
        ].sort(),
      );
      for (const value of Object.values(motion)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("mutes offline and makes needs-input more focused than working", () => {
    expect(motionForActivity("offline").opacity).toBeLessThan(
      motionForActivity("idle").opacity,
    );
    expect(motionForActivity("needs-input").focus).toBeGreaterThan(
      motionForActivity("working").focus,
    );
  });

  it("clamps gaze to normalized unit bounds", () => {
    const bounds = { x: 10, y: 20, width: 100, height: 60 };
    expect(clampGaze(10_000, -10_000, bounds)).toEqual({ x: 1, y: -1 });
    expect(clampGaze(60, 50, bounds)).toEqual({ x: 0, y: 0 });
  });
});
