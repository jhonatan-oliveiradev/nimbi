import type { NimbiActivity } from "../telemetry/contract";
import type { NimbiBehavior, NimbiTransientBehavior } from "./nimbi-behavior";

export interface BehaviorResolutionInput {
  baseline: NimbiBehavior;
  notice?: boolean;
  needsInput?: boolean;
  error?: boolean;
  transient?: NimbiTransientBehavior;
  grab?: boolean;
  dragging?: boolean;
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
    case "complete":
    case "offline":
      return islandOpen ? "listening" : "idle";
  }
}

export function resolveBehavior(input: BehaviorResolutionInput): NimbiBehavior {
  if (input.dragging) return "dragging";
  if (input.grab) return "grab";
  if (input.transient === "tap" || input.transient === "release") return input.transient;
  if (input.needsInput || input.baseline === "needs-input") return "needs-input";
  if (input.error || input.baseline === "error") return "error";
  if (input.transient === "complete") return "complete";

  if (
    input.baseline === "working" ||
    input.baseline === "searching" ||
    input.baseline === "thinking" ||
    input.baseline === "listening"
  ) {
    return input.baseline;
  }

  if (input.notice) return "notice";
  return input.baseline;
}

export class CompletionLatch {
  private previous: NimbiActivity | undefined;

  update(activity: NimbiActivity): boolean {
    const enteredComplete = activity === "complete" && this.previous !== "complete";
    this.previous = activity;
    return enteredComplete;
  }
}
