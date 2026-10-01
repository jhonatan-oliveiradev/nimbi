import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion } from "motion/react";
import { NimbiCloud } from "../nimbi/NimbiCloud";
import {
  DEFAULT_PLACEMENT,
  expansionDirection,
  orientationForPlacement,
  type ExpansionDirection,
  type NimbiPlacement,
  type WorkArea,
} from "../placement/placement";
import { useNimbiDrag } from "../placement/use-nimbi-drag";
import type { NimbiSnapshot } from "../telemetry/contract";
import type { IslandMode } from "./island-machine";
import "./island.css";

const DEFAULT_WORK_AREA: WorkArea = {
  x: 0,
  y: 0,
  width: 640,
  height: 300,
  monitorId: "primary",
};

export interface DynamicIslandProps {
  snapshot: NimbiSnapshot;
  mode: IslandMode;
  onToggle?: () => void;
  fixtureOnly?: boolean;
  reducedMotion?: boolean;
  onBoundsChange?: (rect: { x: number; y: number; width: number; height: number }) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  pointer?: { x: number; y: number };
  placement?: NimbiPlacement;
  workArea?: WorkArea;
  passiveOpacity?: number;
  onPlacementPreview?: (placement: NimbiPlacement) => void;
  onPlacementCommit?: (placement: NimbiPlacement) => void;
  onPassiveOpacityChange?: (value: number) => void;
  onResetPlacement?: () => void;
  nativeShell?: boolean;
  onNativeDragStart?: () => void;
  onNativeDragMove?: () => void;
  onNativeDragEnd?: () => void;
  onNativeDragCancel?: () => void;
}

function statusText(snapshot: NimbiSnapshot): string | undefined {
  const who = snapshot.agent ?? "Agent";

  switch (snapshot.activity) {
    case "thinking":
      return `${who} is thinking…`;
    case "working":
      return `${who} is working…`;
    case "complete":
      return snapshot.agent ? `${snapshot.agent} finished` : "Task finished";
    case "needs-input":
      return snapshot.summary ?? `${who} needs you`;
    case "error":
      return snapshot.summary ?? "Something needs attention";
    case "offline":
      return "Offline";
    case "idle":
      return undefined;
  }
}

function knownMeta(snapshot: NimbiSnapshot): string | undefined {
  const parts = [snapshot.provider, snapshot.model, snapshot.project].filter(
    (value): value is string => Boolean(value),
  );
  return parts.length ? parts.join(" · ") : undefined;
}

function placementStyle(
  placement: NimbiPlacement,
  direction: ExpansionDirection,
  expanded: boolean,
): CSSProperties {
  if (placement.mode === "docked") {
    const percent = `${placement.offset * 100}%`;
    switch (placement.edge) {
      case "top":
        return { top: 0, left: percent, right: "auto", bottom: "auto", translate: "-50% 0" };
      case "bottom":
        return { top: "auto", left: percent, right: "auto", bottom: 0, translate: "-50% 0" };
      case "left":
        return { top: percent, left: 0, right: "auto", bottom: "auto", translate: "0 -50%" };
      case "right":
        return { top: percent, left: "auto", right: 0, bottom: "auto", translate: "0 -50%" };
    }
  }

  const preferredTop = `${placement.y * 100}%`;
  const preferredLeft = `${placement.x * 100}%`;

  if (!expanded) {
    return {
      top: `clamp(calc(var(--island-height) / 2), ${preferredTop}, calc(100% - var(--island-height) / 2))`,
      left: `clamp(calc(var(--island-width) / 2), ${preferredLeft}, calc(100% - var(--island-width) / 2))`,
      right: "auto",
      bottom: "auto",
      translate: "-50% -50%",
    };
  }

  switch (direction) {
    case "down":
      return {
        top: `clamp(0px, ${preferredTop}, calc(100% - var(--island-height)))`,
        left: `clamp(calc(var(--island-width) / 2), ${preferredLeft}, calc(100% - var(--island-width) / 2))`,
        right: "auto",
        bottom: "auto",
        translate: "-50% 0",
      };
    case "up":
      return {
        top: `clamp(var(--island-height), ${preferredTop}, 100%)`,
        left: `clamp(calc(var(--island-width) / 2), ${preferredLeft}, calc(100% - var(--island-width) / 2))`,
        right: "auto",
        bottom: "auto",
        translate: "-50% -100%",
      };
    case "right":
      return {
        top: `clamp(calc(var(--island-height) / 2), ${preferredTop}, calc(100% - var(--island-height) / 2))`,
        left: `clamp(0px, ${preferredLeft}, calc(100% - var(--island-width)))`,
        right: "auto",
        bottom: "auto",
        translate: "0 -50%",
      };
    case "left":
      return {
        top: `clamp(calc(var(--island-height) / 2), ${preferredTop}, calc(100% - var(--island-height) / 2))`,
        left: `clamp(var(--island-width), ${preferredLeft}, 100%)`,
        right: "auto",
        bottom: "auto",
        translate: "-100% -50%",
      };
  }
}

export function DynamicIsland({
  snapshot,
  mode,
  onToggle,
  fixtureOnly = false,
  reducedMotion = false,
  onBoundsChange,
  onPointerEnter,
  onPointerLeave,
  pointer: externalPointer,
  placement = DEFAULT_PLACEMENT,
  workArea = DEFAULT_WORK_AREA,
  passiveOpacity = 0.72,
  onPlacementPreview,
  onPlacementCommit,
  onPassiveOpacityChange,
  onResetPlacement,
  nativeShell = false,
  onNativeDragStart,
  onNativeDragMove,
  onNativeDragEnd,
  onNativeDragCancel,
}: DynamicIslandProps) {
  const islandRef = useRef<HTMLElement | null>(null);
  const characterRef = useRef<HTMLDivElement | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>();
  const [hovered, setHovered] = useState(false);
  const [cloudBounds, setCloudBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const [islandBounds, setIslandBounds] = useState({
    x: workArea.x + workArea.width / 2 - 72,
    y: workArea.y,
    width: 144,
    height: 38,
  });

  const drag = useNimbiDrag({
    placement,
    workArea,
    onPreview: onPlacementPreview,
    onCommit: onPlacementCommit,
    onDragStart: onNativeDragStart,
    onDragMove: onNativeDragMove,
    onDragEnd: onNativeDragEnd,
    onDragCancel: onNativeDragCancel,
  });
  const activePlacement =
    nativeShell ? placement : drag.dragging ? drag.previewPlacement : placement;
  const orientation = orientationForPlacement(activePlacement);
  const direction = useMemo(
    () => expansionDirection(activePlacement, workArea, islandBounds),
    [activePlacement, islandBounds, workArea],
  );

  useLayoutEffect(() => {
    if (!islandRef.current || !characterRef.current) return;
    const island = islandRef.current;
    const character = characterRef.current;
    const report = () => {
      const islandRect = island.getBoundingClientRect();
      const nextIslandBounds = {
        x: islandRect.x,
        y: islandRect.y,
        width: islandRect.width,
        height: islandRect.height,
      };
      setIslandBounds(nextIslandBounds);
      onBoundsChange?.(nextIslandBounds);

      const characterRect = character.getBoundingClientRect();
      setCloudBounds({
        x: characterRect.x,
        y: characterRect.y,
        width: characterRect.width,
        height: characterRect.height,
      });
    };

    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(island);
    observer.observe(character);
    return () => observer.disconnect();
  }, [mode, orientation, activePlacement, onBoundsChange]);

  const status = statusText(snapshot);
  const meta = knownMeta(snapshot);
  const showStatus = !drag.dragging && mode === "compact" && Boolean(status);
  const showDetails =
    !drag.dragging && (mode === "attention" || mode === "expanded");
  const muted = !snapshot.connected || snapshot.activity === "offline";
  const expanded = mode === "attention" || mode === "expanded";

  const pointFromEvent = (event: ReactPointerEvent) => ({
    x: event.clientX + workArea.x,
    y: event.clientY + workArea.y,
  });

  const handleCharacterPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.begin(pointFromEvent(event));
  };

  const handleCharacterPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.move(pointFromEvent(event));
  };

  const handleCharacterPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.end(pointFromEvent(event));
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const handleClick = () => {
    if (drag.consumeSuppressedClick()) return;
    onToggle?.();
  };

  return (
    <motion.section
      ref={islandRef}
      data-testid="nimbi-island"
      data-mode={mode}
      data-muted={String(muted)}
      data-orientation={orientation}
      data-edge={activePlacement.mode === "docked" ? activePlacement.edge : "floating"}
      data-expansion={direction}
      data-dragging={String(drag.dragging)}
      className="nimbi-island"
      aria-label="Nimbi"
      initial={false}
      style={{
        ...(nativeShell
          ? { top: 0, left: 0, right: "auto", bottom: "auto", translate: "0 0" }
          : placementStyle(activePlacement, direction, expanded)),
        opacity: mode === "hidden" ? 0 : 1,
      }}
      animate={{
        opacity: mode === "hidden" ? 0 : 1,
        scale: mode === "hidden" ? 0.96 : drag.dragging ? 0.96 : 1,
      }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      onClick={handleClick}
      onPointerEnter={() => {
        setHovered(true);
        onPointerEnter?.();
      }}
      onPointerMove={(event) =>
        setPointer({ x: event.clientX, y: event.clientY })
      }
      onPointerLeave={() => {
        setHovered(false);
        setPointer(undefined);
        onPointerLeave?.();
      }}
    >
      <div
        ref={characterRef}
        data-testid="nimbi-character"
        className="nimbi-island__character"
        data-dragging={String(drag.dragging)}
        onPointerDown={handleCharacterPointerDown}
        onPointerMove={handleCharacterPointerMove}
        onPointerUp={handleCharacterPointerUp}
        onPointerCancel={() => drag.cancel()}
      >
        <NimbiCloud
          activity={snapshot.activity}
          hidden={mode === "hidden"}
          reducedMotion={reducedMotion}
          pointer={externalPointer ?? pointer}
          bounds={cloudBounds}
          passiveOpacity={passiveOpacity}
          interaction={drag.dragging ? "drag" : hovered ? "hover" : "passive"}
        />
      </div>

      {showStatus ? (
        <div className="nimbi-island__compact-copy">
          <span
            className="nimbi-island__status-dot"
            aria-hidden="true"
            data-activity={snapshot.activity}
          />
          <span className="nimbi-island__compact-text">
            <span data-testid="nimbi-status" className="nimbi-island__status">
              {status}
            </span>
            {meta ? (
              <span data-testid="nimbi-meta" className="nimbi-island__compact-meta">
                {meta}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      {showDetails ? (
        <div
          data-testid={mode === "attention" ? "nimbi-attention" : "nimbi-details"}
          data-fixture-only={mode === "attention" ? String(fixtureOnly) : undefined}
          className="nimbi-island__details"
        >
          <strong className="nimbi-island__headline">
            {status ?? snapshot.summary ?? "Nimbi"}
          </strong>
          {meta ? (
            <span data-testid="nimbi-meta" className="nimbi-island__meta">
              {meta}
            </span>
          ) : null}

          {mode === "attention" && fixtureOnly ? (
            <div className="nimbi-island__fixture-actions" aria-label="Preview actions">
              <button type="button" disabled>
                Deny
              </button>
              <button type="button" disabled>
                Allow
              </button>
            </div>
          ) : null}

          {mode === "expanded" ? (
            <div
              className="nimbi-island__presence-controls"
              onClick={(event) => event.stopPropagation()}
            >
              <label className="nimbi-island__opacity-control">
                <span>Presence</span>
                <input
                  aria-label="Nimbi opacity"
                  type="range"
                  min="20"
                  max="100"
                  step="1"
                  value={Math.round(passiveOpacity * 100)}
                  onChange={(event) =>
                    onPassiveOpacityChange?.(Number(event.currentTarget.value) / 100)
                  }
                />
                <output>{Math.round(passiveOpacity * 100)}%</output>
              </label>
              <button
                type="button"
                className="nimbi-island__reset-position"
                onClick={(event) => {
                  event.stopPropagation();
                  onResetPlacement?.();
                }}
              >
                Reset position
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  );
}
