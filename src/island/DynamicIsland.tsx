import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { NimbiCloud } from "../nimbi/NimbiCloud";
import type { NimbiSnapshot } from "../telemetry/contract";
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
}: DynamicIslandProps) {
  const islandRef = useRef<HTMLElement | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>();
  const [cloudBounds, setCloudBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();

  useLayoutEffect(() => {
    if (!islandRef.current) return;
    const element = islandRef.current;
    const report = () => {
      const rect = element.getBoundingClientRect();
      const bounds = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      setCloudBounds(bounds);
      onBoundsChange?.(bounds);
    };

    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, onBoundsChange]);

  const status = statusText(snapshot);
  const meta = knownMeta(snapshot);
  const showStatus = mode === "compact" && Boolean(status);
  const showDetails = mode === "attention" || mode === "expanded";
  const muted = !snapshot.connected || snapshot.activity === "offline";

  return (
    <motion.section
      ref={islandRef}
      data-testid="nimbi-island"
      data-mode={mode}
      data-muted={String(muted)}
      className="nimbi-island"
      aria-label="Nimbi"
      initial={false}
      animate={{
        opacity: mode === "hidden" ? 0 : 1,
        scale: mode === "hidden" ? 0.96 : 1,
      }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      onClick={onToggle}
      onPointerEnter={onPointerEnter}
      onPointerMove={(event) =>
        setPointer({ x: event.clientX, y: event.clientY })
      }
      onPointerLeave={() => {
        setPointer(undefined);
        onPointerLeave?.();
      }}
    >
      <div className="nimbi-island__character">
        <NimbiCloud
          activity={snapshot.activity}
          hidden={mode === "hidden"}
          reducedMotion={reducedMotion}
          pointer={pointer}
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
          <span data-testid="nimbi-status" className="nimbi-island__status">
            {status}
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
        </div>
      ) : null}
    </motion.section>
  );
}
