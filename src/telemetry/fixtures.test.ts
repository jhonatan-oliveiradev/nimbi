import { describe, expect, it } from "vitest";
import type { NimbiActivity } from "./contract";
import { NIMBI_FIXTURES } from "./fixtures";

const activities: NimbiActivity[] = [
  "offline",
  "idle",
  "thinking",
  "working",
  "needs-input",
  "complete",
  "error",
];

describe("NIMBI_FIXTURES", () => {
  it("covers every semantic Nimbi activity", () => {
    expect(Object.keys(NIMBI_FIXTURES).sort()).toEqual([...activities].sort());
  });

  it("keeps offline free from stale attribution", () => {
    const offline = NIMBI_FIXTURES.offline;
    expect(offline.connected).toBe(false);
    expect(offline.agent).toBeUndefined();
    expect(offline.provider).toBeUndefined();
    expect(offline.model).toBeUndefined();
    expect(offline.project).toBeUndefined();
  });

  it("keeps idle connected without inventing attribution", () => {
    const idle = NIMBI_FIXTURES.idle;
    expect(idle.connected).toBe(true);
    expect(idle.agent).toBeUndefined();
    expect(idle.provider).toBeUndefined();
    expect(idle.model).toBeUndefined();
    expect(idle.project).toBeUndefined();
  });

  it("uses only explicitly supplied working attribution", () => {
    const working = NIMBI_FIXTURES.working;
    expect(working.connected).toBe(true);
    expect(working.agent).toBe("Codex");
    expect(working.provider).toBe("openai");
    expect(working.model).toBe("gpt-5.6");
    expect(working.project).toBe("nimbi");
  });

  it("keeps needs-input as presentation-only fixture data", () => {
    const attention = NIMBI_FIXTURES["needs-input"];
    expect(attention.summary).toBeTruthy();
    expect("requestId" in attention).toBe(false);
  });
});
