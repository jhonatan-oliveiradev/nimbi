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

export type NimbiTransientBehavior = Extract<
  NimbiBehavior,
  "complete" | "tap" | "release"
>;
