import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NimbiActivity } from "../telemetry/contract";
import { useNimbiBehavior } from "./use-nimbi-behavior";

afterEach(() => {
  vi.useRealTimers();
});

describe("useNimbiBehavior", () => {
  it("notices hover and debounces pointer leave", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useNimbiBehavior({ activity: "idle", islandOpen: false }),
    );

    act(() => result.current.onPointerEnter());
    expect(result.current.behavior).toBe("notice");

    act(() => result.current.onPointerLeave());
    expect(result.current.behavior).toBe("notice");

    act(() => vi.advanceTimersByTime(119));
    expect(result.current.behavior).toBe("notice");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.behavior).toBe("idle");
  });

  it("does not flicker when hover returns before debounce expires", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useNimbiBehavior({ activity: "idle", islandOpen: false }),
    );

    act(() => result.current.onPointerEnter());
    act(() => result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(60));
    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(120));

    expect(result.current.behavior).toBe("notice");
  });

  it("plays tap transient then restores the current baseline", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ activity }: { activity: NimbiActivity }) =>
        useNimbiBehavior({ activity, islandOpen: false }),
      { initialProps: { activity: "thinking" as NimbiActivity } },
    );

    act(() => result.current.onTap());
    expect(result.current.behavior).toBe("tap");

    rerender({ activity: "working" as const });
    act(() => vi.advanceTimersByTime(420));

    expect(result.current.behavior).toBe("working");
  });

  it("plays complete once per transition and restores baseline", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ activity }: { activity: NimbiActivity }) =>
        useNimbiBehavior({ activity, islandOpen: false }),
      { initialProps: { activity: "working" as NimbiActivity } },
    );

    rerender({ activity: "complete" as const });
    expect(result.current.behavior).toBe("complete");

    act(() => vi.advanceTimersByTime(900));
    expect(result.current.behavior).toBe("idle");

    rerender({ activity: "complete" as const });
    expect(result.current.behavior).toBe("idle");

    rerender({ activity: "idle" as const });
    rerender({ activity: "complete" as const });
    expect(result.current.behavior).toBe("complete");
  });

  it("lets drag override hover and transients", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useNimbiBehavior({ activity: "idle", islandOpen: false }),
    );

    act(() => result.current.onPointerEnter());
    act(() => result.current.onTap());
    act(() => result.current.onGrab());
    expect(result.current.behavior).toBe("grab");

    act(() => result.current.onDragging());
    expect(result.current.behavior).toBe("dragging");

    act(() => result.current.onRelease());
    expect(result.current.behavior).toBe("release");

    act(() => vi.advanceTimersByTime(360));
    expect(result.current.behavior).toBe("notice");
  });

  it("keeps semantic behavior under reduced motion", () => {
    const { result } = renderHook(() =>
      useNimbiBehavior({
        activity: "needs-input",
        islandOpen: true,
        reducedMotion: true,
      }),
    );

    expect(result.current.behavior).toBe("needs-input");
  });
});
