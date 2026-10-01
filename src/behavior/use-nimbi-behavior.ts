import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NimbiActivity } from "../telemetry/contract";
import type { NimbiBehavior, NimbiTransientBehavior } from "./nimbi-behavior";
import {
  CompletionLatch,
  baselineBehavior,
  resolveBehavior,
} from "./nimbi-behavior-controller";

export const HOVER_LEAVE_DELAY_MS = 120;
export const TAP_REACTION_MS = 420;
export const RELEASE_REACTION_MS = 360;
export const COMPLETE_REACTION_MS = 900;

export interface UseNimbiBehaviorOptions {
  activity: NimbiActivity;
  islandOpen: boolean;
  reducedMotion?: boolean;
}

export interface NimbiBehaviorLifecycle {
  behavior: NimbiBehavior;
  onPointerEnter(): void;
  onPointerLeave(): void;
  onTap(): void;
  onGrab(): void;
  onDragging(): void;
  onRelease(): void;
  onDragCancel(): void;
}

export function useNimbiBehavior({
  activity,
  islandOpen,
}: UseNimbiBehaviorOptions): NimbiBehaviorLifecycle {
  const [notice, setNotice] = useState(false);
  const [transient, setTransient] = useState<NimbiTransientBehavior>();
  const [grab, setGrab] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transientTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completionLatchRef = useRef(new CompletionLatch());

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = undefined;
  }, []);

  const clearTransientTimer = useCallback(() => {
    if (transientTimerRef.current) clearTimeout(transientTimerRef.current);
    transientTimerRef.current = undefined;
  }, []);

  const startTransient = useCallback(
    (next: NimbiTransientBehavior, durationMs: number) => {
      clearTransientTimer();
      setTransient(next);
      transientTimerRef.current = setTimeout(() => {
        transientTimerRef.current = undefined;
        setTransient(undefined);
      }, durationMs);
    },
    [clearTransientTimer],
  );

  useEffect(() => {
    if (completionLatchRef.current.update(activity)) {
      startTransient("complete", COMPLETE_REACTION_MS);
    }
  }, [activity, startTransient]);

  useEffect(
    () => () => {
      clearHoverTimer();
      clearTransientTimer();
    },
    [clearHoverTimer, clearTransientTimer],
  );

  const onPointerEnter = useCallback(() => {
    clearHoverTimer();
    setNotice(true);
  }, [clearHoverTimer]);

  const onPointerLeave = useCallback(() => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = undefined;
      setNotice(false);
    }, HOVER_LEAVE_DELAY_MS);
  }, [clearHoverTimer]);

  const onTap = useCallback(() => {
    startTransient("tap", TAP_REACTION_MS);
  }, [startTransient]);

  const onGrab = useCallback(() => {
    setDragging(false);
    setGrab(true);
  }, []);

  const onDragging = useCallback(() => {
    setGrab(false);
    setDragging(true);
  }, []);

  const onRelease = useCallback(() => {
    setGrab(false);
    setDragging(false);
    startTransient("release", RELEASE_REACTION_MS);
  }, [startTransient]);

  const onDragCancel = useCallback(() => {
    setGrab(false);
    setDragging(false);
  }, []);

  const baseline = baselineBehavior(activity, islandOpen);
  const behavior = useMemo(
    () =>
      resolveBehavior({
        baseline,
        notice,
        transient,
        grab,
        dragging,
      }),
    [baseline, dragging, grab, notice, transient],
  );

  return {
    behavior,
    onPointerEnter,
    onPointerLeave,
    onTap,
    onGrab,
    onDragging,
    onRelease,
    onDragCancel,
  };
}
