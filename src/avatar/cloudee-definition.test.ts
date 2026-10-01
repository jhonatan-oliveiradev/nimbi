import { describe, expect, it } from "vitest";
import {
  CLOUDEE_DEFINITION,
  NIMBI_CLOUDEE_BODY,
  NIMBI_CLOUDEE_DEFINITION,
} from "./cloudee-definition";

const REQUIRED_ANIMATIONS = [
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
] as const;

describe("Cloudee definition", () => {
  it("loads the exported Cloudee runtime definition", () => {
    expect(CLOUDEE_DEFINITION.schema).toBe("bible-strong/avatar-definition");
    expect(CLOUDEE_DEFINITION.name).toBe("Cloudee");

    for (const animation of REQUIRED_ANIMATIONS) {
      expect(CLOUDEE_DEFINITION.animations).toHaveProperty(animation);
    }
  });

  it("derives Nimbi color without mutating the source export", () => {
    const sourceBody = CLOUDEE_DEFINITION.colors.body;

    expect(NIMBI_CLOUDEE_BODY).toBe("#c8c5ff");
    expect(NIMBI_CLOUDEE_DEFINITION.colors.body).toBe(NIMBI_CLOUDEE_BODY);
    expect(CLOUDEE_DEFINITION.colors.body).toBe(sourceBody);
    expect(NIMBI_CLOUDEE_DEFINITION).not.toBe(CLOUDEE_DEFINITION);
    expect(NIMBI_CLOUDEE_DEFINITION.colors).not.toBe(CLOUDEE_DEFINITION.colors);
  });
});
