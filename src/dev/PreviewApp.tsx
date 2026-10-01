import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      const next = ACTIVITIES[index];
      if (next) setActivity(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="nimbi-preview">
      <NimbiApp
        snapshot={snapshot}
        mode={modeFor(activity)}
        fixtureOnly
      />

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
