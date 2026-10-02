import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NimbiPlacement, WorkArea } from "./placement";
import { useNimbiDrag } from "./use-nimbi-drag";

const area: WorkArea = {
  x: 0,
  y: 0,
  width: 1000,
  height: 700,
  monitorId: "preview",
};

const startPlacement: NimbiPlacement = {
  mode: "docked",
  monitorId: "preview",
  edge: "top",
  offset: 0.5,
};

describe("useNimbiDrag", () => {
  it("does not turn a click into a drag below the movement threshold", () => {
    const commit = vi.fn();
    const { result } = renderHook(() =>
      useNimbiDrag({
        placement: startPlacement,
        workArea: area,
        onCommit: commit,
      }),
    );

    act(() => result.current.begin({ x: 500, y: 10 }));
    act(() => result.current.move({ x: 503, y: 13 }));
    expect(result.current.dragging).toBe(false);

    act(() => result.current.end({ x: 503, y: 13 }));
    expect(commit).not.toHaveBeenCalled();
  });

  it("fires drag lifecycle callbacks only after crossing the movement threshold", () => {
    const onDragStart = vi.fn();
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    const { result } = renderHook(() =>
      useNimbiDrag({
        placement: startPlacement,
        workArea: area,
        onDragStart,
        onDragMove,
        onDragEnd,
      }),
    );

    act(() => result.current.begin({ x: 500, y: 10 }));
    act(() => result.current.move({ x: 503, y: 12 }));
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onDragMove).not.toHaveBeenCalled();

    act(() => result.current.move({ x: 508, y: 10 }));
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragMove).toHaveBeenCalledTimes(1);

    act(() => result.current.end({ x: 520, y: 200 }));
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it("keeps the drag preview floating while exposing the magnetic dock target", () => {
    const preview = vi.fn();
    const commit = vi.fn();
    const { result } = renderHook(() =>
      useNimbiDrag({
        placement: startPlacement,
        workArea: area,
        onPreview: preview,
        onCommit: commit,
      }),
    );

    act(() => result.current.begin({ x: 500, y: 10 }));
    act(() => result.current.move({ x: 508, y: 10 }));

    expect(result.current.dragging).toBe(true);
    expect(result.current.previewPlacement).toMatchObject({
      mode: "floating",
    });
    expect(result.current.dockCandidate).toBe("top");
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "floating" }),
    );

    act(() => result.current.end({ x: 508, y: 10 }));
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "docked", edge: "top" }),
    );
    expect(result.current.dockCandidate).toBeUndefined();
  });

  it("commits a floating placement when released away from all edges", () => {
    const commit = vi.fn();
    const { result } = renderHook(() =>
      useNimbiDrag({
        placement: startPlacement,
        workArea: area,
        onCommit: commit,
      }),
    );

    act(() => result.current.begin({ x: 500, y: 10 }));
    act(() => result.current.move({ x: 520, y: 150 }));
    act(() => result.current.end({ x: 520, y: 350 }));

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "floating" }),
    );
  });

  it("cancels back to the committed placement", () => {
    const { result } = renderHook(() =>
      useNimbiDrag({ placement: startPlacement, workArea: area }),
    );

    act(() => result.current.begin({ x: 500, y: 10 }));
    act(() => result.current.move({ x: 520, y: 200 }));
    expect(result.current.dragging).toBe(true);

    act(() => result.current.cancel());
    expect(result.current.dragging).toBe(false);
    expect(result.current.previewPlacement).toEqual(startPlacement);
  });
});
