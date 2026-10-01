import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACEMENT,
  DEFAULT_PRESENCE,
  deriveAxisAlignment,
  deriveExpansionDirection,
  deriveOrientation,
  effectivePresence,
  hostRectForPlacement,
  normalizePlacement,
  normalizePresence,
  placementFromPoint,
  type ViewportRect,
} from "./placement";

const viewport: ViewportRect = { width: 1200, height: 800 };

describe("placement model", () => {
  it("defaults to top-center", () => {
    expect(DEFAULT_PLACEMENT).toEqual({ mode: "docked", edge: "top", offset: 0.5 });
    expect(DEFAULT_PRESENCE.idleOpacity).toBe(0.72);
  });

  it("clamps dock offsets and floating coordinates", () => {
    expect(
      normalizePlacement({ mode: "docked", edge: "right", offset: 3 }),
    ).toEqual({ mode: "docked", edge: "right", offset: 1 });

    expect(
      normalizePlacement({ mode: "floating", x: -2, y: 4 }),
    ).toEqual({ mode: "floating", x: 0, y: 1 });
  });

  it("maps edge docks to adaptive orientation", () => {
    expect(deriveOrientation({ mode: "docked", edge: "top", offset: 0.5 }, viewport))
      .toBe("horizontal");
    expect(deriveOrientation({ mode: "docked", edge: "bottom", offset: 0.5 }, viewport))
      .toBe("horizontal");
    expect(deriveOrientation({ mode: "docked", edge: "left", offset: 0.5 }, viewport))
      .toBe("vertical");
    expect(deriveOrientation({ mode: "docked", edge: "right", offset: 0.5 }, viewport))
      .toBe("vertical");
  });

  it("uses vertical floating layout in lateral zones", () => {
    expect(
      deriveOrientation({ mode: "floating", x: 0.08, y: 0.5 }, viewport),
    ).toBe("vertical");
    expect(
      deriveOrientation({ mode: "floating", x: 0.92, y: 0.5 }, viewport),
    ).toBe("vertical");
    expect(
      deriveOrientation({ mode: "floating", x: 0.5, y: 0.5 }, viewport),
    ).toBe("horizontal");
  });

  it("expands away from a docked edge", () => {
    expect(deriveExpansionDirection(
      { mode: "docked", edge: "top", offset: 0.5 }, viewport,
    )).toBe("down");
    expect(deriveExpansionDirection(
      { mode: "docked", edge: "bottom", offset: 0.5 }, viewport,
    )).toBe("up");
    expect(deriveExpansionDirection(
      { mode: "docked", edge: "left", offset: 0.5 }, viewport,
    )).toBe("right");
    expect(deriveExpansionDirection(
      { mode: "docked", edge: "right", offset: 0.5 }, viewport,
    )).toBe("left");
  });

  it("chooses the largest free direction while floating", () => {
    expect(
      deriveExpansionDirection({ mode: "floating", x: 0.8, y: 0.5 }, viewport),
    ).toBe("left");
    expect(
      deriveExpansionDirection({ mode: "floating", x: 0.2, y: 0.5 }, viewport),
    ).toBe("right");
  });

  it("aligns floating surfaces away from nearby perpendicular edges", () => {
    expect(deriveAxisAlignment(0.1)).toBe("start");
    expect(deriveAxisAlignment(0.5)).toBe("center");
    expect(deriveAxisAlignment(0.9)).toBe("end");
  });

  it("snaps points inside the magnetic edge threshold", () => {
    expect(placementFromPoint({ x: 600, y: 20 }, viewport, 64)).toEqual({
      mode: "docked",
      edge: "top",
      offset: 0.5,
    });
    expect(placementFromPoint({ x: 1185, y: 400 }, viewport, 64)).toEqual({
      mode: "docked",
      edge: "right",
      offset: 0.5,
    });
  });

  it("keeps points away from edges floating and normalized", () => {
    expect(placementFromPoint({ x: 600, y: 400 }, viewport, 64)).toEqual({
      mode: "floating",
      x: 0.5,
      y: 0.5,
    });
  });

  it("derives a host rect that stays inside the viewport", () => {
    const top = hostRectForPlacement(
      { mode: "docked", edge: "top", offset: 0.98 },
      viewport,
    );
    expect(top.x).toBeGreaterThanOrEqual(0);
    expect(top.x + top.width).toBeLessThanOrEqual(viewport.width);
    expect(top.y).toBe(0);
    expect(top.x + top.anchorX).toBeCloseTo(viewport.width * 0.98);

    const floating = hostRectForPlacement(
      { mode: "floating", x: 0.99, y: 0.99 },
      viewport,
    );
    expect(floating.x + floating.width).toBeLessThanOrEqual(viewport.width);
    expect(floating.y + floating.height).toBeLessThanOrEqual(viewport.height);
    expect(floating.x + floating.anchorX).toBeCloseTo(viewport.width * 0.99);
    expect(floating.y + floating.anchorY).toBeCloseTo(viewport.height * 0.99);
  });
});

describe("presence model", () => {
  it("clamps user idle opacity", () => {
    expect(normalizePresence({ idleOpacity: 0.1 }).idleOpacity).toBe(0.25);
    expect(normalizePresence({ idleOpacity: 2 }).idleOpacity).toBe(1);
  });

  it("keeps actionable attention fully legible", () => {
    expect(effectivePresence("needs-input", 0.25, false)).toBe(1);
    expect(effectivePresence("idle", 0.25, true)).toBe(1);
  });

  it("raises active states above very low idle opacity", () => {
    expect(effectivePresence("thinking", 0.3, false)).toBeGreaterThanOrEqual(0.58);
    expect(effectivePresence("working", 0.3, false)).toBeGreaterThanOrEqual(0.68);
    expect(effectivePresence("error", 0.3, false)).toBeGreaterThanOrEqual(0.9);
  });
});
