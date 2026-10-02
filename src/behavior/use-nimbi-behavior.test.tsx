import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NimbiActivity } from "../telemetry/contract";
import {
  COMPLETE_REACTION_MS,
  HOVER_LEAVE_DEBOUNCE_MS,
  RELEASE_REACTION_MS,
  TAP_REACTION_MS,
  useNimbiBehavior,
} from "./use-nimbi-behavior";

describe("useNimbiBehavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces hover leave and cancels the leave when the pointer returns", () => {
    const { result } = renderHook(() =>
      useNimbiBehavior({
        activity: "idle",
        islandOpen: false,
        reducedMotion: false,
      }),
    );

    act(() => result.current.onHoverStart());
    expect(result.current.behavior).toBe("notice");

    act(() => result.current.onHoverEnd());
    act(() => vi.advanceTimersByTime(HOVER_LEAVE_DEBOUNCE_MS - 1));
    expect(result.current.behavior).toBe("notice");

    act(() => result.current.onHoverStart());
    act(() => vi.advanceTimersByTime(HOVER_LEAVE_DEBOUNCE_MS + 1));
    expect(result.current.behavior).toBe("notice");

    act(() => result.current.onHoverEnd());
    act(() => vi.advanceTimersByTime(HOVER_LEAVE_DEBOUNCE_MS));
    expect(result.current.behavior).toBe("idle");
  });

  it("restores the live baseline after a tap reaction", () => {
    const { result } = renderHook(() =>
      useNimbiBehavior({
        activity: "working",
        islandOpen: false,
        reducedMotion: false,
      }),
    );

    act(() => result.current.onTap());
    expect(result.current.behavior).toBe("tap");

    act(() => vi.advanceTimersByTime(TAP_REACTION_MS));
    expect(result.current.behavior).toBe("working");
  });

  it("celebrates complete only once per transition into complete", () => {
    const { result, rerender } = renderHook(
      ({ activity }) =>
        useNimbiBehavior({
          activity,
          islandOpen: false,
          reducedMotion: false,
        }),
      { initialProps: { activity: "working" as NimbiActivity } },
    );

    rerender({ activity: "complete" as const });
    expect(result.current.behavior).toBe("complete");

    act(() => vi.advanceTimersByTime(COMPLETE_REACTION_MS));
    expect(result.current.behavior).toBe("idle");

    rerender({ activity: "complete" as const });
    expect(result.current.behavior).toBe("idle");

    rerender({ activity: "idle" as const });
    rerender({ activity: "complete" as const });
    expect(result.current.behavior).toBe("complete");
  });

  it("keeps active dragging above hover and restores baseline after release", () => {
    const { result } = renderHook(() =>
      useNimbiBehavior({
        activity: "idle",
        islandOpen: false,
        reducedMotion: false,
      }),
    );

    act(() => result.current.onHoverStart());
    act(() => result.current.onGrab());
    expect(result.current.behavior).toBe("grab");

    act(() => result.current.onDragging());
    expect(result.current.behavior).toBe("dragging");

    act(() => result.current.onHoverEnd());
    act(() => vi.advanceTimersByTime(HOVER_LEAVE_DEBOUNCE_MS));
    expect(result.current.behavior).toBe("dragging");

    act(() => result.current.onRelease());
    expect(result.current.behavior).toBe("release");

    act(() => vi.advanceTimersByTime(RELEASE_REACTION_MS));
    expect(result.current.behavior).toBe("idle");
  });

  it("cancels manipulation without inventing a reaction", () => {
    const { result } = renderHook(() =>
      useNimbiBehavior({
        activity: "thinking",
        islandOpen: false,
        reducedMotion: false,
      }),
    );

    act(() => {
      result.current.onGrab();
      result.current.onDragging();
      result.current.onDragCancel();
    });

    expect(result.current.behavior).toBe("thinking");
  });

  it("maps action composition and sending into companion behavior", () => {
    const { result, rerender } = renderHook(
      ({ actionStatus }) =>
        useNimbiBehavior({
          activity: "idle",
          islandOpen: true,
          reducedMotion: false,
          actionStatus,
        }),
      { initialProps: { actionStatus: "composing" as const } },
    );

    expect(result.current.behavior).toBe("listening");

    rerender({ actionStatus: "sending" as const });
    expect(result.current.behavior).toBe("thinking");

    rerender({ actionStatus: "error" as const });
    expect(result.current.behavior).toBe("error");
  });

  it("keeps real attention above composing but action transport error above attention", () => {
    const { result, rerender } = renderHook(
      ({ actionStatus }) =>
        useNimbiBehavior({
          activity: "needs-input",
          islandOpen: true,
          reducedMotion: false,
          actionStatus,
        }),
      { initialProps: { actionStatus: "composing" as const } },
    );

    expect(result.current.behavior).toBe("needs-input");

    rerender({ actionStatus: "error" as const });
    expect(result.current.behavior).toBe("error");
  });

  it("uses a brief complete reaction for a short action response", () => {
    const { result, rerender } = renderHook(
      ({ actionStatus }) =>
        useNimbiBehavior({
          activity: "idle",
          islandOpen: true,
          reducedMotion: false,
          actionStatus,
        }),
      { initialProps: { actionStatus: "sending" as const } },
    );

    rerender({ actionStatus: "response" as const });
    expect(result.current.behavior).toBe("complete");

    act(() => vi.advanceTimersByTime(COMPLETE_REACTION_MS));
    expect(result.current.behavior).toBe("listening");
  });

  it("keeps semantic priority unchanged under reduced motion", () => {
    const { result, rerender } = renderHook(
      ({ reducedMotion }) =>
        useNimbiBehavior({
          activity: "needs-input",
          islandOpen: true,
          reducedMotion,
        }),
      { initialProps: { reducedMotion: false } },
    );

    expect(result.current.behavior).toBe("needs-input");
    rerender({ reducedMotion: true });
    expect(result.current.behavior).toBe("needs-input");
  });
});