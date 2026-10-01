import type { NimbiActivity } from "../telemetry/contract";

export type PresenceInteraction = "passive" | "hover" | "drag";

const MINIMUMS: Record<NimbiActivity, number> = {
  offline: 0.2,
  idle: 0.2,
  thinking: 0.55,
  working: 0.65,
  "needs-input": 1,
  complete: 0.75,
  error: 0.9,
};

export function clampPassiveOpacity(value: number): number {
  if (!Number.isFinite(value)) return 0.72;
  return Math.min(1, Math.max(0.2, value));
}

export function effectiveOpacity(
  activity: NimbiActivity,
  passiveOpacity: number,
  interaction: PresenceInteraction,
): number {
  if (interaction === "hover" || interaction === "drag") return 1;
  const configured = clampPassiveOpacity(passiveOpacity);
  return Math.max(configured, MINIMUMS[activity]);
}
