import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  placement = DEFAULT_PLACEMENT,
  presence = DEFAULT_PRESENCE,
  viewport,
  dragging = false,
  onCharacterPointerDown,
}: NimbiAppProps) {
  const nativeRuntime = snapshot === undefined && isTauriRuntime();
  const liveSnapshot = useNimbiSnapshot(nativeRuntime);
  const currentSnapshot =
    snapshot ?? (nativeRuntime ? liveSnapshot : NIMBI_FIXTURES.idle);
  const prefersReducedMotion = useReducedMotion();
  const motionReduced = reducedMotion || Boolean(prefersReducedMotion);

  const machineRef = useRef<IslandMachine | null>(null);
  if (!machineRef.current) machineRef.current = new IslandMachine();
  const machine = machineRef.current;

  const [machineMode, setMachineMode] = useState<IslandMode>(() =>
    defaultMode(currentSnapshot),
  );
  const [desktopPointer, setDesktopPointer] = useState<{ x: number; y: number }>();

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

  const reportBounds = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (!nativeRuntime) return;
      void invoke("set_island_rect", rect);
    },
    [nativeRuntime],
  );

  const handleToggle = () => {
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
      placement={placement}
      presence={presence}
      viewport={
        viewport ??
        (typeof window !== "undefined"
          ? { width: window.innerWidth, height: window.innerHeight }
          : { width: 1200, height: 800 })
      }
      dragging={dragging}
      onCharacterPointerDown={onCharacterPointerDown}
    />
  );
}
