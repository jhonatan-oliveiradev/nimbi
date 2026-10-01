import { describe, expect, it } from "vitest";
import {
  clampPlacement,
  expansionDirection,
  orientationForPlacement,
  snapPlacement,
  type NimbiPlacement,
  type WorkArea,
} from "./placement";

const area: WorkArea = { x: 100, y: 50, width: 1200, height: 800 };
const surface = { width: 200, height: 80 };

describe("placement geometry", () => {
  it("maps dock edges to adaptive orientation", () => {
    expect(
      orientationForPlacement({
        mode: "docked",
        monitorId: "m1",
        edge: "top",
        offset: 0.5,
      }),
    ).toBe("horizontal");
    expect(
      orientationForPlacement({
        mode: "docked",
        monitorId: "m1",
        edge: "bottom",
        offset: 0.5,
      }),
    ).toBe("horizontal");
    expect(
      orientationForPlacement({
        mode: "docked",
        monitorId: "m1",
        edge: "left",
        offset: 0.5,
      }),
    ).toBe("vertical");
    expect(
      orientationForPlacement({
        mode: "docked",
        monitorId: "m1",
        edge: "right",
        offset: 0.5,
      }),
    ).toBe("vertical");
  });

  it("snaps within 56 logical pixels of each edge", () => {
    expect(snapPlacement({ x: 700, y: 80 }, area, undefined, 56)).toMatchObject({
      mode: "docked",
      edge: "top",
    });
    expect(snapPlacement({ x: 700, y: 830 }, area, undefined, 56)).toMatchObject({
      mode: "docked",
      edge: "bottom",
    });
    expect(snapPlacement({ x: 130, y: 450 }, area, undefined, 56)).toMatchObject({
      mode: "docked",
      edge: "left",
    });
    expect(snapPlacement({ x: 1270, y: 450 }, area, undefined, 56)).toMatchObject({
      mode: "docked",
      edge: "right",
    });
  });

  it("prefers the previous edge on an exact corner tie", () => {
    const previous: NimbiPlacement = {
      mode: "docked",
      monitorId: "m1",
      edge: "left",
      offset: 0.5,
    };
    const result = snapPlacement({ x: 120, y: 70 }, area, previous, 56);
    expect(result).toMatchObject({ mode: "docked", edge: "left" });
  });

  it("prefers a horizontal edge on an exact corner tie without history", () => {
    const result = snapPlacement({ x: 120, y: 70 }, area, undefined, 56);
    expect(result).toMatchObject({ mode: "docked", edge: "top" });
  });

  it("keeps releases away from edges floating with normalized coordinates", () => {
    const result = snapPlacement({ x: 700, y: 450 }, area, undefined, 56);
    expect(result).toEqual({
      mode: "floating",
      monitorId: "current",
      x: 0.5,
      y: 0.5,
    });
  });

  it("clamps dock offsets so the whole surface remains in the work area", () => {
    const clamped = clampPlacement(
      {
        mode: "docked",
        monitorId: "m1",
        edge: "top",
        offset: 0,
      },
      area,
      surface,
    );
    expect(clamped).toEqual({
      mode: "docked",
      monitorId: "m1",
      edge: "top",
      offset: 200 / 2 / 1200,
    });
  });

  it("clamps floating centers so the whole surface remains onscreen", () => {
    const clamped = clampPlacement(
      {
        mode: "floating",
        monitorId: "m1",
        x: -0.2,
        y: 1.4,
      },
      area,
      surface,
    );
    expect(clamped.mode).toBe("floating");
    if (clamped.mode === "floating") {
      expect(clamped.x).toBeCloseTo(100 / 1200);
      expect(clamped.y).toBeCloseTo(1 - 40 / 800);
    }
  });

  it("uses the dock edge to choose an inward expansion direction", () => {
    expect(
      expansionDirection(
        { mode: "docked", monitorId: "m1", edge: "top", offset: 0.5 },
        area,
        { x: 600, y: 50, width: 200, height: 40 },
      ),
    ).toBe("down");
    expect(
      expansionDirection(
        { mode: "docked", monitorId: "m1", edge: "right", offset: 0.5 },
        area,
        { x: 1100, y: 400, width: 200, height: 40 },
      ),
    ).toBe("left");
  });

  it("chooses the largest safe area for floating expansion", () => {
    const result = expansionDirection(
      { mode: "floating", monitorId: "m1", x: 0.15, y: 0.5 },
      area,
      { x: 180, y: 410, width: 160, height: 80 },
    );
    expect(result).toBe("right");
  });
});
