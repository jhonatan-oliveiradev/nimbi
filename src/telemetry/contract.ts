export type NimbiActivity =
  | "offline"
  | "idle"
  | "thinking"
  | "working"
  | "needs-input"
  | "complete"
  | "error";

export interface NimbiSnapshot {
  connected: boolean;
  protocol?: "runoptic.telemetry.v1";
  activity: NimbiActivity;
  sessionId?: string;
  agent?: string;
  provider?: string;
  model?: string;
  project?: string;
  environment?: string;
  summary?: string;
  observedAt?: number;
}
