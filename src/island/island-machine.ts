import type { NimbiActivity } from "../telemetry/contract";

export type IslandMode =
  | "hidden"
  | "idle"
  | "compact"
  | "attention"
  | "expanded";

export class IslandMachine {
  mode: IslandMode = "idle";
  onTransition: ((from: IslandMode, to: IslandMode) => void) | undefined;

  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private passiveMode: Extract<IslandMode, "idle" | "compact"> = "idle";

  setActivity(activity: NimbiActivity) {
    this.clearHideTimer();

    if (activity === "needs-input" || activity === "error") {
      this.transition("attention");
      return;
    }

    const passive: Extract<IslandMode, "idle" | "compact"> =
      activity === "working" || activity === "thinking" || activity === "complete"
        ? "compact"
        : "idle";

    this.passiveMode = passive;
    if (this.mode !== "expanded") {
      this.transition(passive);
    }
  }

  pointerEnter() {
    this.clearHideTimer();
    if (this.mode === "hidden") {
      this.transition(this.passiveMode);
    }
  }

  pointerLeave() {
    if (this.mode !== "idle" && this.mode !== "compact") return;
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      if (this.mode === "idle" || this.mode === "compact") {
        this.transition("hidden");
      }
    }, 60_000);
  }

  toggleExpanded() {
    this.clearHideTimer();

    if (this.mode === "expanded") {
      this.transition(this.passiveMode);
      return;
    }

    if (this.mode === "idle" || this.mode === "compact") {
      this.passiveMode = this.mode;
    }
    this.transition("expanded");
  }

  forceHidden() {
    this.clearHideTimer();
    this.transition("hidden");
  }

  dispose() {
    this.clearHideTimer();
  }

  private transition(next: IslandMode) {
    if (next === this.mode) return;
    const previous = this.mode;
    this.mode = next;
    this.onTransition?.(previous, next);
  }

  private clearHideTimer() {
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }
}
