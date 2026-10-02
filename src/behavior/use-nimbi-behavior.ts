import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ActionUiState } from "../actions/contract";
import type { NimbiActivity } from "../telemetry/contract";
import type {
  DirectInteraction,
  NimbiBehavior,
} from "./nimbi-behavior";
import {
  CompletionLatch,
  baselineBehavior,
  resolveBehavior,
} from "./nimbi-behavior-controller";

export const HOVER_LEAVE_DEBOUNCE_MS = 120;
export const TAP_REACTION_MS = 450;
export const RELEASE_REACTION_MS = 420;
export const COMPLETE_REACTION_MS = 1100;

export interface UseNimbiBehaviorOptions {
  activity: NimbiActivity;
  islandOpen: boolean;
  reducedMotion: boolean;
  actionStatus?: ActionUiState["status"];
}

export interface NimbiBehaviorEvents {
  onHoverStart(): void;
  onHoverEnd(): void;
  onTap(): void;
  onGrab(): void;
  onDragging(): void;
  onRelease(): void;
  onDragCancel(): void;
}

export interface NimbiBehaviorLifecycle extends NimbiBehaviorEvents {
  behavior: NimbiBehavior;
}

export function useNimbiBehavior({
  activity,
  islandOpen,
  reducedMotion,
  actionStatus,
}: UseNimbiBehaviorOptions): NimbiBehaviorLifecycle {
  const [hovered, setHovered] = useState(false);
  const [interaction, setInteraction] = useState<DirectInteraction>();
  const [transient, setTransient] = useState<NimbiBehavior>();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transientTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completionLatch = useRef<CompletionLatch | null>(null);
  const previousActionStatus = useRef<ActionUiState["status"] | undefined>(undefined);

  if (!completionLatch.current) completionLatch.current = new CompletionLatch();

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current !== undefined) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = undefined;
    }
  }, []);

  const clearTransientTimer = useCallback(() => {
    if (transientTimer.current !== undefined) {
      clearTimeout(transientTimer.current);
      transientTimer.current = undefined;
    }
  }, []);

  const scheduleTransient = useCallback(
    (next: NimbiBehavior, durationMs: number) => {
      clearTransientTimer();
      setTransient(next);
      const duration = reducedMotion ? Math.max(80, Math.round(durationMs * 0.5)) : durationMs;
      transientTimer.current = setTimeout(() => {
        transientTimer.current = undefined;
        setTransient(undefined);
      }, duration);
    },
    [clearTransientTimer, reducedMotion],
  );

  useEffect(() => {
    const enteredComplete = completionLatch.current?.update(activity) ?? false;
    if (enteredComplete) {
      scheduleTransient("complete", COMPLETE_REACTION_MS);
    }
  }, [activity, scheduleTransient]);

  useEffect(() => {
    const enteredResponse =
      actionStatus === "response" &&
      previousActionStatus.current !== "response";
    previousActionStatus.current = actionStatus;
    if (enteredResponse) {
      scheduleTransient("complete", COMPLETE_REACTION_MS);
    }
  }, [actionStatus, scheduleTransient]);


  useEffect(
    () => () => {
      clearHoverTimer();
      clearTransientTimer();
    },
    [clearHoverTimer, clearTransientTimer],
  );

  const onHoverStart = useCallback(() => {
    clearHoverTimer();
    setHovered(true);
  }, [clearHoverTimer]);

  const onHoverEnd = useCallback(() => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = undefined;
      setHovered(false);
    }, HOVER_LEAVE_DEBOUNCE_MS);
  }, [clearHoverTimer]);

  const onTap = useCallback(() => {
    scheduleTransient("tap", TAP_REACTION_MS);
  }, [scheduleTransient]);

  const onGrab = useCallback(() => {
    setInteraction("grab");
  }, []);

  const onDragging = useCallback(() => {
    setInteraction("dragging");
  }, []);

  const onRelease = useCallback(() => {
    setInteraction(undefined);
    scheduleTransient("release", RELEASE_REACTION_MS);
  }, [scheduleTransient]);

  const onDragCancel = useCallback(() => {
    setInteraction(undefined);
  }, []);

  const baseline = useMemo(() => {
    const semantic = baselineBehavior(activity, islandOpen);

    if (actionStatus === "error") return "error";
    if (activity === "needs-input" || activity === "error") return semantic;
    if (actionStatus === "sending") return "thinking";
    if (actionStatus === "composing") return "listening";

    return semantic;
  }, [actionStatus, activity, islandOpen]);
  const behavior = resolveBehavior({
    baseline,
    hovered,
    interaction,
    transient,
  });

  return {
    behavior,
    onHoverStart,
    onHoverEnd,
    onTap,
    onGrab,
    onDragging,
    onRelease,
    onDragCancel,
  };
}