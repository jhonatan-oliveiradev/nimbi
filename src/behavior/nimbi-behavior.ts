export type NimbiBehavior =
  | "idle"
  | "notice"
  | "listening"
  | "thinking"
  | "searching"
  | "working"
  | "complete"
  | "needs-input"
  | "error"
  | "tap"
  | "grab"
  | "dragging"
  | "release";

export type DirectInteraction = "tap" | "grab" | "dragging" | "release";
