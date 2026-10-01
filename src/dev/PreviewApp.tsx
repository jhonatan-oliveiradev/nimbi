import { useEffect, useMemo, useState } from "react";
import { NimbiApp } from "../app/NimbiApp";
import {
  DEFAULT_PLACEMENT,
  type NimbiPlacement,
  type WorkArea,
} from "../placement/placement";
import { PlacementDebugOverlay } from "../placement/PlacementDebugOverlay";
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

const PLACEMENT_FIXTURES: Array<{
  label: string;
  placement: NimbiPlacement;
}> = [
  {
    label: "Dock top",
    placement: { mode: "docked", monitorId: "preview", edge: "top", offset: 0.5 },
  },
  {
    label: "Dock right",
    placement: { mode: "docked", monitorId: "preview", edge: "right", offset: 0.5 },
  },
  {
    label: "Dock bottom",
    placement: { mode: "docked", monitorId: "preview", edge: "bottom", offset: 0.5 },
  },
  {
    label: "Dock left",
    placement: { mode: "docked", monitorId: "preview", edge: "left", offset: 0.5 },
  },
  {
    label: "Float top left",
    placement: { mode: "floating", monitorId: "preview", x: 0.08, y: 0.1 },
  },
  {
    label: "Float top right",
    placement: { mode: "floating", monitorId: "preview", x: 0.92, y: 0.1 },
  },
  {
    label: "Float bottom left",
    placement: { mode: "floating", monitorId: "preview", x: 0.08, y: 0.9 },
  },
  {
    label: "Float bottom right",
    placement: { mode: "floating", monitorId: "preview", x: 0.92, y: 0.9 },
  },
];

function viewportWorkArea(): WorkArea {
  return {
    x: 0,
    y: 0,
    width: Math.max(320, window.innerWidth),
    height: Math.max(240, window.innerHeight),
    monitorId: "preview",
  };
}

function placementLabel(placement: NimbiPlacement): string {
  if (placement.mode === "floating") {
    return `floating · ${Math.round(placement.x * 100)}% / ${Math.round(placement.y * 100)}%`;
  }
  return `${placement.edge} · ${Math.round(placement.offset * 100)}%`;
}

export function PreviewApp() {
  const [activity, setActivity] = useState<NimbiActivity>("idle");
  const [placement, setPlacement] =
    useState<NimbiPlacement>(DEFAULT_PLACEMENT);
  const [passiveOpacity, setPassiveOpacity] = useState(0.72);
  const [workArea, setWorkArea] = useState<WorkArea>(() => viewportWorkArea());
  const snapshot = useMemo(() => NIMBI_FIXTURES[activity], [activity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      const next = ACTIVITIES[index];
      if (next) setActivity(next);
    };
    const onResize = () => setWorkArea(viewportWorkArea());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="nimbi-preview">
      <PlacementDebugOverlay />
      <NimbiApp
        snapshot={snapshot}
        fixtureOnly
        placement={placement}
        workArea={workArea}
        passiveOpacity={passiveOpacity}
        onPlacementChange={setPlacement}
        onPassiveOpacityChange={setPassiveOpacity}
        onResetPlacement={() => setPlacement(DEFAULT_PLACEMENT)}
      />

      <div className="nimbi-preview__placement-readout" aria-live="polite">
        {placementLabel(placement)} · {Math.round(passiveOpacity * 100)}%
      </div>

      <nav
        className="nimbi-preview__placement-fixtures"
        aria-label="Nimbi placement fixtures"
      >
        {PLACEMENT_FIXTURES.map(({ label, placement: fixture }) => (
          <button
            key={label}
            type="button"
            onClick={() => setPlacement(fixture)}
          >
            {label}
          </button>
        ))}
      </nav>

      <nav className="nimbi-preview__controls" aria-label="Nimbi preview states">
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
      </nav>
    </div>
  );
}
