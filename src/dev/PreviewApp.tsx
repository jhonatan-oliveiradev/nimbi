import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { NimbiApp } from "../app/NimbiApp";
import type { IslandMode } from "../island/island-machine";
import {
  DEFAULT_PLACEMENT,
  DEFAULT_PRESENCE,
  hostRectForPlacement,
  normalizePlacement,
  normalizePresence,
  placementFromPoint,
  type NimbiEdge,
  type NimbiPlacement,
  type NimbiPresence,
  type ViewportRect,
} from "../placement/placement";
import type { NimbiActivity } from "../telemetry/contract";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";

const ACTIVITIES: NimbiActivity[] = [
  "idle",
  "thinking",
  "working",
  "needs-input",
  "complete",
  "error",
  "offline",
];

const STORAGE_KEY = "nimbi.preview.preferences.v1";
const DRAG_THRESHOLD = 5;
const DOCK_THRESHOLD = 64;

interface StoredPreviewPreferences {
  placement: NimbiPlacement;
  presence: NimbiPresence;
}

function modeFor(activity: NimbiActivity): IslandMode {
  if (activity === "needs-input" || activity === "error") return "attention";
  if (activity === "thinking" || activity === "working" || activity === "complete") {
    return "compact";
  }
  return "idle";
}

function viewportNow(): ViewportRect {
  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  };
}

function floatingPlacement(
  clientX: number,
  clientY: number,
  viewport: ViewportRect,
): NimbiPlacement {
  return normalizePlacement({
    mode: "floating",
    x: clientX / viewport.width,
    y: clientY / viewport.height,
  });
}

function placementLabel(placement: NimbiPlacement): string {
  if (placement.mode === "docked") {
    return `${placement.edge} · ${Math.round(placement.offset * 100)}%`;
  }
  return `float · ${Math.round(placement.x * 100)}%, ${Math.round(
    placement.y * 100,
  )}%`;
}

export function PreviewApp() {
  const [activity, setActivity] = useState<NimbiActivity>("idle");
  const [placement, setPlacement] = useState<NimbiPlacement>(DEFAULT_PLACEMENT);
  const [presence, setPresence] = useState<NimbiPresence>(DEFAULT_PRESENCE);
  const [viewport, setViewport] = useState<ViewportRect>(() => viewportNow());
  const [dragging, setDragging] = useState(false);
  const [dragPlacement, setDragPlacement] = useState<NimbiPlacement>();
  const [dockCandidate, setDockCandidate] = useState<NimbiEdge>();
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);

  const snapshot = useMemo(() => NIMBI_FIXTURES[activity], [activity]);
  const renderedPlacement = dragPlacement ?? placement;
  const hostRect = hostRectForPlacement(renderedPlacement, viewport);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      const next = ACTIVITIES[index];
      if (next) setActivity(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onResize = () => setViewport(viewportNow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredPreviewPreferences>;
      if (parsed.placement) setPlacement(normalizePlacement(parsed.placement));
      if (parsed.presence) setPresence(normalizePresence(parsed.presence));
    } catch {
      // Preview preferences are disposable; malformed state falls back safely.
    }
  }, []);

  useEffect(() => {
    const value: StoredPreviewPreferences = { placement, presence };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, [placement, presence]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const distance = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );

      if (!drag.active && distance < DRAG_THRESHOLD) return;
      if (!drag.active) {
        drag.active = true;
        setDragging(true);
      }

      const currentViewport = viewportNow();
      setViewport(currentViewport);
      setDragPlacement(
        floatingPlacement(event.clientX, event.clientY, currentViewport),
      );

      const candidate = placementFromPoint(
        { x: event.clientX, y: event.clientY },
        currentViewport,
        DOCK_THRESHOLD,
      );
      setDockCandidate(candidate.mode === "docked" ? candidate.edge : undefined);
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (drag.active) {
        const currentViewport = viewportNow();
        const resolved = placementFromPoint(
          { x: event.clientX, y: event.clientY },
          currentViewport,
          DOCK_THRESHOLD,
        );
        setPlacement(resolved);
      }

      dragRef.current = null;
      setDragging(false);
      setDragPlacement(undefined);
      setDockCandidate(undefined);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const handleCloudPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  };

  const resetPlacement = () => {
    setPlacement(DEFAULT_PLACEMENT);
    setDragPlacement(undefined);
    setDockCandidate(undefined);
  };

  const hostStyle = {
    left: hostRect.x,
    top: hostRect.y,
    width: hostRect.width,
    height: hostRect.height,
  } satisfies CSSProperties;

  return (
    <div className="nimbi-preview">
      {(["top", "right", "bottom", "left"] as NimbiEdge[]).map((edge) => (
        <div
          key={edge}
          className="nimbi-preview__dock-cue"
          data-edge={edge}
          data-active={String(dragging && dockCandidate === edge)}
        />
      ))}

      <div className="nimbi-preview__host" style={hostStyle}>
        <NimbiApp
          snapshot={snapshot}
          mode={modeFor(activity)}
          fixtureOnly
          placement={renderedPlacement}
          presence={presence}
          viewport={viewport}
          dragging={dragging}
          anchor={{ x: hostRect.anchorX, y: hostRect.anchorY }}
          onCharacterPointerDown={handleCloudPointerDown}
        />
      </div>

      <nav className="nimbi-preview__controls" aria-label="Nimbi preview controls">
        {ACTIVITIES.map((state, index) => (
          <button
            key={state}
            type="button"
            data-active={String(state === activity)}
            onClick={() => setActivity(state)}
            title={`${index + 1} · ${state}`}
          >
            <span className="nimbi-preview__shortcut">{index + 1}</span>
            {state}
          </button>
        ))}

        <span className="nimbi-preview__placement-label">
          {placementLabel(placement)}
        </span>

        <label className="nimbi-preview__presence">
          Presence
          <input
            aria-label="Nimbi idle opacity"
            type="range"
            min="25"
            max="100"
            step="1"
            value={Math.round(presence.idleOpacity * 100)}
            onChange={(event) =>
              setPresence(
                normalizePresence({
                  idleOpacity: Number(event.currentTarget.value) / 100,
                }),
              )
            }
          />
          <span>{Math.round(presence.idleOpacity * 100)}%</span>
        </label>

        <button type="button" onClick={resetPlacement}>
          Reset position
        </button>
      </nav>
    </div>
  );
}
