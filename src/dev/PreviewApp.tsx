import { useMemo, useState } from "react";
import { NimbiApp } from "../app/NimbiApp";
import type { IslandMode } from "../island/island-machine";
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

function modeFor(activity: NimbiActivity): IslandMode {
  if (activity === "needs-input" || activity === "error") return "attention";
  if (activity === "thinking" || activity === "working" || activity === "complete") {
    return "compact";
  }
  return "idle";
}

export function PreviewApp() {
  const [activity, setActivity] = useState<NimbiActivity>("idle");
  const snapshot = useMemo(() => NIMBI_FIXTURES[activity], [activity]);

  return (
    <div className="nimbi-preview">
      <NimbiApp
        snapshot={snapshot}
        mode={modeFor(activity)}
        fixtureOnly
      />

      <nav className="nimbi-preview__controls" aria-label="Nimbi preview states">
        {ACTIVITIES.map((state) => (
          <button
            key={state}
            type="button"
            data-active={String(state === activity)}
            onClick={() => setActivity(state)}
          >
            {state}
          </button>
        ))}
      </nav>
    </div>
  );
}
