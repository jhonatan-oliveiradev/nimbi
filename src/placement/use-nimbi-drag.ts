import { useCallback, useEffect, useRef, useState } from "react";
import {
  snapPlacement,
  type NimbiPlacement,
  type Point,
  type WorkArea,
} from "./placement";

export const DRAG_THRESHOLD = 6;

export interface UseNimbiDragOptions {
  placement: NimbiPlacement;
  workArea: WorkArea;
  threshold?: number;
  onPreview?: (placement: NimbiPlacement) => void;
  onCommit?: (placement: NimbiPlacement) => void;
  onDragStart?: () => void;
  onDragMove?: () => void;
  onDragEnd?: () => void;
  onDragCancel?: () => void;
}

export interface NimbiDragController {
  dragging: boolean;
  previewPlacement: NimbiPlacement;
  begin(point: Point): void;
  move(point: Point): void;
  end(point: Point): void;
  cancel(): void;
  consumeSuppressedClick(): boolean;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function useNimbiDrag({
  placement,
  workArea,
  threshold = DRAG_THRESHOLD,
  onPreview,
  onCommit,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: UseNimbiDragOptions): NimbiDragController {
  const startRef = useRef<Point | undefined>(undefined);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [previewPlacement, setPreviewPlacement] = useState(placement);

  useEffect(() => {
    if (!draggingRef.current) setPreviewPlacement(placement);
  }, [placement]);

  const begin = useCallback((point: Point) => {
    startRef.current = point;
    draggingRef.current = false;
    suppressClickRef.current = false;
    setDragging(false);
  }, []);

  const move = useCallback(
    (point: Point) => {
      const start = startRef.current;
      if (!start) return;

      if (!draggingRef.current && distance(start, point) < threshold) return;

      if (!draggingRef.current) {
        draggingRef.current = true;
        suppressClickRef.current = true;
        setDragging(true);
        onDragStart?.();
      }

      onDragMove?.();
      const next = snapPlacement(point, workArea, placement);
      setPreviewPlacement(next);
      onPreview?.(next);
    },
    [onDragMove, onDragStart, onPreview, placement, threshold, workArea],
  );

  const finish = useCallback(
    (point?: Point, commit = true) => {
      const wasDragging = draggingRef.current;
      if (wasDragging && point && commit) {
        const next = snapPlacement(point, workArea, placement);
        setPreviewPlacement(next);
        onPreview?.(next);
        onCommit?.(next);
        onDragEnd?.();
      } else if (!commit) {
        setPreviewPlacement(placement);
        if (wasDragging) onDragCancel?.();
      }

      startRef.current = undefined;
      draggingRef.current = false;
      setDragging(false);
    },
    [onCommit, onDragCancel, onDragEnd, onPreview, placement, workArea],
  );

  const end = useCallback((point: Point) => finish(point, true), [finish]);
  const cancel = useCallback(() => finish(undefined, false), [finish]);

  const consumeSuppressedClick = useCallback(() => {
    const suppressed = suppressClickRef.current;
    suppressClickRef.current = false;
    return suppressed;
  }, []);

  return {
    dragging,
    previewPlacement,
    begin,
    move,
    end,
    cancel,
    consumeSuppressedClick,
  };
}
