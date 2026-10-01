import type { NimbiActivity } from "../telemetry/contract";
import type { DirectInteraction, NimbiBehavior } from "./nimbi-behavior";

const PRIORITY: Record<NimbiBehavior, number> = {
  dragging: 110,
  grab: 110,
  tap: 100,
  release: 100,
  "needs-input": 90,
  error: 80,
  complete: 70,
  working: 60,
  searching: 50,
  thinking: 40,
  listening: 30,
  notice: 20,
  idle: 10,
};

export interface BehaviorResolutionInput {
  baseline: NimbiBehavior;
  hovered?: boolean;
  interaction?: DirectInteraction;
  transient?: NimbiBehavior;
}

export function baselineBehavior(
  activity: NimbiActivity,
  islandOpen: boolean,
): NimbiBehavior {
  switch (activity) {
    case "thinking":
      return "thinking";
    case "working":
      return "working";
    case "needs-input":
      return "needs-input";
    case "error":
      return "error";
    case "idle":
      return islandOpen ? "listening" : "idle";
    case "offline":
    case "complete":
      return islandOpen ? "listening" : "idle";
  }
}

export function resolveBehavior({
  baseline,
  hovered = false,
  interaction,
  transient,
}: BehaviorResolutionInput): NimbiBehavior {
  const candidates: NimbiBehavior[] = [
    baseline,
    hovered ? "notice" : "idle",
  ];
  if (transient) candidates.push(transient);
  if (interaction) candidates.push(interaction);

  return candidates.reduce((current, candidate) =>
    PRIORITY[candidate] > PRIORITY[current] ? candidate : current,
  );
}

export class CompletionLatch {
  private previous?: NimbiActivity;

  update(activity: NimbiActivity): boolean {
    const enteredComplete = activity === "complete" && this.previous !== "complete";
    this.previous = activity;
    return enteredComplete;
  }
}
