import { DynamicIsland } from "../island/DynamicIsland";
import type { IslandMode } from "../island/island-machine";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import type { NimbiSnapshot } from "../telemetry/contract";

export interface NimbiAppProps {
  snapshot?: NimbiSnapshot;
  mode?: IslandMode;
  fixtureOnly?: boolean;
  reducedMotion?: boolean;
  onToggle?: () => void;
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

export function NimbiApp({
  snapshot = NIMBI_FIXTURES.idle,
  mode,
  fixtureOnly = false,
  reducedMotion = false,
  onToggle,
}: NimbiAppProps) {
  return (
    <DynamicIsland
      snapshot={snapshot}
      mode={mode ?? defaultMode(snapshot)}
      fixtureOnly={fixtureOnly}
      reducedMotion={reducedMotion}
      onToggle={onToggle}
    />
  );
}
