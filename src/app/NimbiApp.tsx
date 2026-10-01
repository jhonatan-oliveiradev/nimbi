import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from "react";
import { DynamicIsland } from "../island/DynamicIsland";
import { IslandMachine, type IslandMode } from "../island/island-machine";
import type { NimbiSnapshot } from "../telemetry/contract";
import {
  DEFAULT_PLACEMENT,
  DEFAULT_PRESENCE,
  type NimbiPlacement,
  type NimbiPresence,
  type ViewportRect,
} from "../placement/placement";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import { useNimbiPreferences } from "../placement/use-nimbi-preferences";
import { useNimbiSnapshot } from "../telemetry/use-nimbi-snapshot";

export interface NimbiAppProps {
  snapshot?: NimbiSnapshot;
  mode?: IslandMode;
  fixtureOnly?: boolean;
  reducedMotion?: boolean;
  onToggle?: () => void;
  placement?: NimbiPlacement;
  presence?: NimbiPresence;
  viewport?: ViewportRect;
  dragging?: boolean;
  anchor?: { x: number; y: number };
  onCharacterPointerDown?: PointerEventHandler<HTMLDivElement>;
}

function defaultMode(snapshot: NimbiSnapshot): IslandMode {
  if (snapshot.activity === "needs-input" || snapshot.activity === "error") {
    return "attention";
  }
  if (
    snapshot.activity === "thinking" ||
    snapshot.activity === "working" ||
    snapshot.activity === "complete"
  ) {
    return "compact";
  }
  return "idle";
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}

export function NimbiApp({
  snapshot,
  mode,
  fixtureOnly = false,
  reducedMotion = false,
  onToggle,
  placement,
  presence,
  viewport,
  dragging,
  anchor,
  onCharacterPointerDown,
}: NimbiAppProps) {
  const nativeRuntime = snapshot === undefined && isTauriRuntime();
  const liveSnapshot = useNimbiSnapshot(nativeRuntime);
  const nativePreferences = useNimbiPreferences(nativeRuntime);
  const currentSnapshot =
    snapshot ?? (nativeRuntime ? liveSnapshot : NIMBI_FIXTURES.idle);
  const currentPlacement =
    placement ??
    (nativeRuntime
      ? nativePreferences.preferences.placement
      : DEFAULT_PLACEMENT);
  const currentPresence =
    presence ??
    (nativeRuntime
      ? nativePreferences.preferences.presence
      : DEFAULT_PRESENCE);
  const currentViewport =
    viewport ??
    (nativeRuntime && nativePreferences.layout
      ? {
          width: nativePreferences.layout.viewportWidth,
          height: nativePreferences.layout.viewportHeight,
        }
      : typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 1200, height: 800 });
  const currentAnchor =
    anchor ??
    (nativeRuntime && nativePreferences.layout
      ? {
          x: nativePreferences.layout.anchorX,
          y: nativePreferences.layout.anchorY,
        }
      : undefined);
  const prefersReducedMotion = useReducedMotion();
  const motionReduced = reducedMotion || Boolean(prefersReducedMotion);

  const machineRef = useRef<IslandMachine | null>(null);
  if (!machineRef.current) machineRef.current = new IslandMachine();
  const machine = machineRef.current;

  const [machineMode, setMachineMode] = useState<IslandMode>(() =>
    defaultMode(currentSnapshot),
  );
  const [desktopPointer, setDesktopPointer] = useState<{ x: number; y: number }>();
  const [nativeDragging, setNativeDragging] = useState(false);
  const nativeDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;
  } | null>(null);
  const dragSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressToggleRef = useRef(false);

  useEffect(() => {
    machine.onTransition = (_from, next) => setMachineMode(next);
    return () => {
      machine.onTransition = undefined;
      machine.dispose();
    };
  }, [machine]);

  useEffect(() => {
    machine.setActivity(currentSnapshot.activity);
    setMachineMode(machine.mode);
  }, [currentSnapshot.activity, machine]);

  const renderedMode = mode ?? machineMode;

  useEffect(() => {
    if (!nativeRuntime) return;
    const hidden = renderedMode === "hidden";
    void invoke("set_visibility_hint", { hidden });
    void invoke("set_collapsed", { collapsed: hidden });
    void invoke("set_interactive", {
      interactive: renderedMode === "expanded",
    });
  }, [nativeRuntime, renderedMode]);

  useEffect(() => {
    if (!nativeRuntime) {
      setDesktopPointer(undefined);
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen<{ x: number; y: number }>("nimbi://cursor", (event) => {
      if (!disposed) setDesktopPointer(event.payload);
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [nativeRuntime]);

  useEffect(() => {
    if (!nativeRuntime || renderedMode !== "hidden") return;
    const wake = () => machine.pointerEnter();
    window.addEventListener("pointermove", wake, { passive: true });
    return () => window.removeEventListener("pointermove", wake);
  }, [machine, nativeRuntime, renderedMode]);

  useEffect(() => {
    if (!nativeRuntime || onCharacterPointerDown) return;

    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlistenMoved: (() => void) | undefined;

    const clearSettleTimer = () => {
      if (dragSettleTimerRef.current !== null) {
        clearTimeout(dragSettleTimerRef.current);
        dragSettleTimerRef.current = null;
      }
    };

    const finishDrag = () => {
      const drag = nativeDragRef.current;
      if (!drag?.started || disposed) return;
      nativeDragRef.current = null;
      clearSettleTimer();
      setNativeDragging(false);
      suppressToggleRef.current = true;
      void invoke("resolve_placement_from_cursor").finally(() => {
        window.setTimeout(() => {
          suppressToggleRef.current = false;
        }, 80);
      });
    };

    const scheduleFinish = () => {
      clearSettleTimer();
      dragSettleTimerRef.current = window.setTimeout(finishDrag, 260);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = nativeDragRef.current;
      if (!drag || drag.started || event.pointerId !== drag.pointerId) return;
      const distance = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );
      if (distance < 5) return;

      drag.started = true;
      suppressToggleRef.current = true;
      setNativeDragging(true);
      void appWindow.startDragging().catch(() => {
        nativeDragRef.current = null;
        setNativeDragging(false);
        suppressToggleRef.current = false;
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = nativeDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.started) {
        nativeDragRef.current = null;
        return;
      }
      scheduleFinish();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });

    void appWindow.onMoved(() => {
      if (nativeDragRef.current?.started) scheduleFinish();
    }).then((stop) => {
      if (disposed) stop();
      else unlistenMoved = stop;
    }).catch(() => {});

    return () => {
      disposed = true;
      clearSettleTimer();
      unlistenMoved?.();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [nativeRuntime, onCharacterPointerDown]);

  const handleNativeCharacterPointerDown: PointerEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (!nativeRuntime || onCharacterPointerDown || event.button !== 0) return;
    nativeDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
  };

  const reportBounds = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (!nativeRuntime) return;
      void invoke("set_island_rect", rect);
    },
    [nativeRuntime],
  );

  const handleToggle = () => {
    if (suppressToggleRef.current) return;
    if (onToggle) {
      onToggle();
      return;
    }
    machine.toggleExpanded();
  };

  return (
    <DynamicIsland
      snapshot={currentSnapshot}
      mode={renderedMode}
      fixtureOnly={fixtureOnly}
      reducedMotion={motionReduced}
      onToggle={handleToggle}
      onBoundsChange={reportBounds}
      onPointerEnter={mode === undefined ? () => machine.pointerEnter() : undefined}
      onPointerLeave={mode === undefined ? () => machine.pointerLeave() : undefined}
      pointer={desktopPointer}
      placement={currentPlacement}
      presence={currentPresence}
      viewport={currentViewport}
      dragging={dragging ?? nativeDragging}
      anchor={currentAnchor}
      onCharacterPointerDown={
        onCharacterPointerDown ?? handleNativeCharacterPointerDown
      }
    />
  );
}
