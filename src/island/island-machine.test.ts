import { afterEach, describe, expect, it, vi } from "vitest";
import { IslandMachine } from "./island-machine";

afterEach(() => {
  vi.useRealTimers();
});

describe("IslandMachine", () => {
  it("starts idle", () => {
    expect(new IslandMachine().mode).toBe("idle");
  });

  it.each(["working", "thinking", "complete"] as const)(
    "maps %s activity to compact",
    (activity) => {
      const machine = new IslandMachine();
      machine.setActivity(activity);
      expect(machine.mode).toBe("compact");
    },
  );

  it.each(["needs-input", "error"] as const)(
    "maps %s activity to attention",
    (activity) => {
      const machine = new IslandMachine();
      machine.setActivity(activity);
      expect(machine.mode).toBe("attention");
    },
  );

  it("does not force an attention panel while offline", () => {
    const machine = new IslandMachine();
    machine.setActivity("offline");
    expect(machine.mode).toBe("idle");
  });

  it("toggles idle or compact into expanded and returns to the prior passive mode", () => {
    const machine = new IslandMachine();
    machine.setActivity("working");
    expect(machine.mode).toBe("compact");

    machine.toggleExpanded();
    expect(machine.mode).toBe("expanded");

    machine.toggleExpanded();
    expect(machine.mode).toBe("compact");
  });

  it("reveals from hidden on pointer entry", () => {
    const machine = new IslandMachine();
    machine.forceHidden();
    machine.pointerEnter();
    expect(machine.mode).toBe("idle");
  });

  it("hides idle only after sixty seconds away", () => {
    vi.useFakeTimers();
    const machine = new IslandMachine();

    machine.pointerLeave();
    vi.advanceTimersByTime(59_999);
    expect(machine.mode).toBe("idle");

    vi.advanceTimersByTime(1);
    expect(machine.mode).toBe("hidden");
  });

  it("never auto-hides an attention state", () => {
    vi.useFakeTimers();
    const machine = new IslandMachine();
    machine.setActivity("needs-input");

    machine.pointerLeave();
    vi.advanceTimersByTime(120_000);
    expect(machine.mode).toBe("attention");
  });
});
