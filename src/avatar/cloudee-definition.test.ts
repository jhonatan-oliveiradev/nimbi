import { describe, expect, it } from "vitest";
import {
  CLOUDEE_DEFINITION,
  NIMBI_CLOUDEE_DEFINITION,
  NIMBI_CLOUDEE_BODY_COLOR,
} from "./cloudee-definition";

describe("Cloudee definition", () => {
  it("loads the exported Cloudee avatar contract", () => {
    expect(CLOUDEE_DEFINITION.schema).toBe("bible-strong/avatar-definition");
    expect(CLOUDEE_DEFINITION.name).toBe("Cloudee");

    for (const key of [
      "idle",
      "listening",
      "thinking",
      "searching",
      "working",
      "happy",
      "curious",
      "confused",
      "playful",
      "celebrate",
    ] as const) {
      expect(CLOUDEE_DEFINITION.animations[key]).toBeDefined();
    }
  });

  it("derives Nimbi color without mutating the exported definition", () => {
    expect(CLOUDEE_DEFINITION.colors.body).toBe("#c9cbcf");
    expect(NIMBI_CLOUDEE_DEFINITION.colors.body).toBe(NIMBI_CLOUDEE_BODY_COLOR);
    expect(NIMBI_CLOUDEE_BODY_COLOR).toBe("#ddd8ff");
    expect(CLOUDEE_DEFINITION.colors.body).toBe("#c9cbcf");
  });
});
