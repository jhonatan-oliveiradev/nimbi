import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNimbiActions } from "../actions/use-nimbi-actions";
import type { NimbiActionRequest, NimbiActionResult } from "../actions/contract";
import { useNimbiBehavior } from "../behavior/use-nimbi-behavior";
import { DynamicIsland } from "../island/DynamicIsland";
import { IslandMachine, type IslandMode } from "../island/island-machine";
import {
  DEFAULT_PLACEMENT,
  type NimbiPlacement,
  type WorkArea,
} from "../placement/placement";
import { useNimbiPreferences } from "../preferences/use-nimbi-preferences";
import type { NimbiSnapshot } from "../telemetry/contract";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import { useNimbiSnapshot } from "../telemetry/use-nimbi-snapshot";

export interface NimbiAppProps {
  snapshot?: NimbiSnapshot;
  mode?: IslandMode;
  fixtureOnly?: boolean;
  reducedMotion?: boolean;
  onToggle?: () => void;
  placement?: NimbiPlacement;
  workArea?: WorkArea;
  passiveOpacity?: number;
  onPlacementChange?: (placement: NimbiPlacement) => void;
  onPassiveOpacityChange?: (value: number) => void;
  onResetPlacement?: () => void;
  actionSubmit?: (request: NimbiActionRequest) => Promise<NimbiActionResult>;
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
  workArea,
  passiveOpacity,
  onPlacementChange,
  onPassiveOpacityChange,
  onResetPlacement,
  actionSubmit,
}: NimbiAppProps) {
  const nativeRuntime = snapshot === undefined && isTauriRuntime();
  const liveSnapshot = useNimbiSnapshot(nativeRuntime);
  const {
    preferences,
    savePassiveOpacity,
    resetPlacement,
  } = useNimbiPreferences(nativeRuntime);
  const currentSnapshot =
    snapshot ?? (nativeRuntime ? liveSnapshot : NIMBI_FIXTURES.idle);
  const prefersReducedMotion = useReducedMotion();
  const motionReduced = reducedMotion || Boolean(prefersReducedMotion);

  const previewActionSubmit = useCallback(
    async (request: NimbiActionRequest): Promise<NimbiActionResult> => ({
      accepted: true,
      response:
        request.type === "reply"
          ? "Got it. I'll keep going."
          : "Started. I'll keep an eye on it.",
      sessionId:
        request.type === "reply" ? request.sessionId : "nimbi-preview-session",
    }),
    [],
  );
  const actions = useNimbiActions({
    snapshot: currentSnapshot,
    submit: actionSubmit ?? (nativeRuntime ? undefined : previewActionSubmit),
  });

  const machineRef = useRef<IslandMachine | null>(null);
  if (!machineRef.current) machineRef.current = new IslandMachine();
  const machine = machineRef.current;

  const [machineMode, setMachineMode] = useState<IslandMode>(() =>
    defaultMode(currentSnapshot),
  );
  const [desktopPointer, setDesktopPointer] = useState<{ x: number; y: number }>();
  const [localPlacement, setLocalPlacement] =
    useState<NimbiPlacement>(DEFAULT_PLACEMENT);
  const [localPassiveOpacity, setLocalPassiveOpacity] = useState(0.72);
  const currentPlacement =
    placement ?? (nativeRuntime ? preferences.placement : localPlacement);
  const currentPassiveOpacity =
    passiveOpacity ??
    (nativeRuntime
      ? preferences.presence.passiveOpacity
      : localPassiveOpacity);
  const currentWorkArea: WorkArea =
    workArea ??
    {
      x: 0,
      y: 0,
      width: typeof window === "undefined" ? 640 : window.innerWidth,
      height: typeof window === "undefined" ? 300 : window.innerHeight,
      monitorId: "primary",
    };

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

  const actionActive = actions.state.status !== "idle";
  const actionForcesExpanded =
    actionActive && currentSnapshot.activity !== "needs-input";
  const renderedMode =
    mode ?? (actionForcesExpanded ? "expanded" : machineMode);
  const behaviorLifecycle = useNimbiBehavior({
    activity: currentSnapshot.activity,
    islandOpen: renderedMode === "expanded",
    reducedMotion: motionReduced,
    actionStatus: actions.state.status,
  });

  useEffect(() => {
    if (!nativeRuntime) return;
    const hidden = renderedMode === "hidden";
    void invoke("set_visibility_hint", { hidden });
    void invoke("set_collapsed", { collapsed: hidden });
    void invoke("set_interactive", {
      interactive: renderedMode === "expanded" || actionActive,
    });
  }, [actionActive, nativeRuntime, renderedMode]);

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

  const reportBounds = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (!nativeRuntime) return;
      void invoke("set_island_rect", rect);
    },
    [nativeRuntime],
  );

  const handlePlacementCommit = (next: NimbiPlacement) => {
    if (nativeRuntime) return;
    if (placement === undefined) setLocalPlacement(next);
    onPlacementChange?.(next);
  };

  const handlePassiveOpacityChange = (value: number) => {
    onPassiveOpacityChange?.(value);
    if (onPassiveOpacityChange) return;
    if (nativeRuntime) {
      void savePassiveOpacity(value);
      return;
    }
    setLocalPassiveOpacity(value);
  };

  const handleResetPlacement = () => {
    onResetPlacement?.();
    if (onResetPlacement) return;
    if (nativeRuntime) {
      void resetPlacement();
      return;
    }
    setLocalPlacement(DEFAULT_PLACEMENT);
  };

  const restoreSemanticMode = () => {
    machine.setActivity(currentSnapshot.activity);
    setMachineMode(machine.mode);
  };

  const handleActionClose = () => {
    actions.close();
    restoreSemanticMode();
  };

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
      return;
    }

    if (actionActive) {
      handleActionClose();
      return;
    }

    machine.toggleExpanded();
  };

  const handleCharacterActivate = () => {
    if (actionActive) {
      handleActionClose();
      return;
    }

    if (currentSnapshot.activity === "needs-input") {
      actions.open("contextual");
      return;
    }

    actions.open("general");
  };

  return (
    <DynamicIsland
      snapshot={currentSnapshot}
      mode={renderedMode}
      fixtureOnly={fixtureOnly}
      reducedMotion={motionReduced}
      onToggle={handleToggle}
      onCharacterActivate={handleCharacterActivate}
      behavior={behaviorLifecycle.behavior}
      behaviorEvents={behaviorLifecycle}
      onBoundsChange={reportBounds}
      onPointerEnter={mode === undefined ? () => machine.pointerEnter() : undefined}
      onPointerLeave={mode === undefined ? () => machine.pointerLeave() : undefined}
      pointer={desktopPointer}
      placement={currentPlacement}
      workArea={currentWorkArea}
      passiveOpacity={currentPassiveOpacity}
      onPlacementCommit={handlePlacementCommit}
      onPassiveOpacityChange={handlePassiveOpacityChange}
      onResetPlacement={handleResetPlacement}
      actionState={actions.state}
      canActionRetry={actions.canRetry}
      onActionOpen={actions.open}
      onActionDraftChange={actions.setDraft}
      onActionSubmit={() => void actions.submit()}
      onActionRetry={() => void actions.retry()}
      onActionClose={handleActionClose}
      nativeShell={nativeRuntime}
      onNativeDragStart={
        nativeRuntime ? () => void invoke("begin_drag") : undefined
      }
      onNativeDragMove={
        nativeRuntime ? () => void invoke("move_drag") : undefined
      }
      onNativeDragEnd={
        nativeRuntime ? () => void invoke("commit_drag") : undefined
      }
      onNativeDragCancel={
        nativeRuntime ? () => void invoke("cancel_drag") : undefined
      }
    />
  );
}