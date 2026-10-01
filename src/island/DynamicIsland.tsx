import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEventHandler } from "react";
import { motion } from "motion/react";
import { NimbiCloud } from "../nimbi/NimbiCloud";
import type { NimbiSnapshot } from "../telemetry/contract";
import {
  DEFAULT_PLACEMENT,
  DEFAULT_PRESENCE,
  deriveAxisAlignment,
  deriveExpansionDirection,
  deriveOrientation,
  effectivePresence,
  type NimbiPlacement,
  type NimbiPresence,
  type ViewportRect,
} from "../placement/placement";
import type { IslandMode } from "./island-machine";
import "./island.css";

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
  presence?: NimbiPresence;
  viewport?: ViewportRect;
  dragging?: boolean;
  anchor?: { x: number; y: number };
  onCharacterPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPresenceChange?: (idleOpacity: number) => void;
  onResetPlacement?: () => void;
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
  presence = DEFAULT_PRESENCE,
  viewport = { width: 1200, height: 800 },
  dragging = false,
  anchor,
  onCharacterPointerDown,
  onPresenceChange,
  onResetPlacement,
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

  useLayoutEffect(() => {
    if (!islandRef.current || !characterRef.current) return;
    const island = islandRef.current;
    const character = characterRef.current;
    const report = () => {
      const islandRect = island.getBoundingClientRect();
      onBoundsChange?.({
        x: islandRect.x,
        y: islandRect.y,
        width: islandRect.width,
        height: islandRect.height,
      });

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
  }, [mode, onBoundsChange]);

  const status = statusText(snapshot);
  const meta = knownMeta(snapshot);
  const orientation = deriveOrientation(placement, viewport);
  const expansion = deriveExpansionDirection(placement, viewport);
  const presenceOpacity = effectivePresence(
    snapshot.activity,
    presence.idleOpacity,
    hovered,
  );
  const edge = placement.mode === "docked" ? placement.edge : "floating";
  const floatingX =
    placement.mode === "floating" ? deriveAxisAlignment(placement.x) : "center";
  const floatingY =
    placement.mode === "floating" ? deriveAxisAlignment(placement.y) : "center";
  const style = {
    "--nimbi-presence": String(presenceOpacity),
    ...(anchor
      ? {
          "--nimbi-anchor-x": `${anchor.x}px`,
          "--nimbi-anchor-y": `${anchor.y}px`,
        }
      : {}),
  } as CSSProperties;
  const showStatus = mode === "compact" && Boolean(status);
  const showDetails = mode === "attention" || mode === "expanded";
  const muted = !snapshot.connected || snapshot.activity === "offline";

  return (
    <motion.section
      ref={islandRef}
      data-testid="nimbi-island"
      data-mode={mode}
      data-muted={String(muted)}
      data-placement-mode={placement.mode}
      data-edge={edge}
      data-orientation={orientation}
      data-expansion={expansion}
      data-float-x={floatingX}
      data-float-y={floatingY}
      data-dragging={String(dragging)}
      className="nimbi-island"
      style={style}
      aria-label="Nimbi"
      initial={false}
      animate={{
        opacity: mode === "hidden" ? 0 : 1,
        scale: mode === "hidden" ? 0.96 : 1,
      }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      onClick={onToggle}
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
        className="nimbi-island__character"
        data-testid="nimbi-character"
        onPointerDown={onCharacterPointerDown}
      >
        <NimbiCloud
          activity={snapshot.activity}
          hidden={mode === "hidden"}
          reducedMotion={reducedMotion}
          pointer={externalPointer ?? pointer}
          bounds={cloudBounds}
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

          {mode === "expanded" && (onPresenceChange || onResetPlacement) ? (
            <div
              className="nimbi-island__preferences"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {onPresenceChange ? (
                <label className="nimbi-island__presence-control">
                  <span>Presence</span>
                  <input
                    aria-label="Nimbi presence"
                    type="range"
                    min="25"
                    max="100"
                    step="1"
                    value={Math.round(presence.idleOpacity * 100)}
                    onChange={(event) =>
                      onPresenceChange(Number(event.currentTarget.value) / 100)
                    }
                  />
                  <span>{Math.round(presence.idleOpacity * 100)}%</span>
                </label>
              ) : null}

              {onResetPlacement ? (
                <button
                  className="nimbi-island__reset-placement"
                  type="button"
                  onClick={onResetPlacement}
                >
                  Top center
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  );
}
