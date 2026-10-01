import type { NimbiActivity, NimbiSnapshot } from "./contract";

const liveBase = {
  connected: true,
  protocol: "runoptic.telemetry.v1" as const,
};

export const NIMBI_FIXTURES: Record<NimbiActivity, NimbiSnapshot> = {
  offline: {
    connected: false,
    activity: "offline",
    summary: "RunOptic unavailable",
  },
  idle: {
    ...liveBase,
    activity: "idle",
    summary: "All quiet",
  },
  thinking: {
    ...liveBase,
    activity: "thinking",
    sessionId: "codex-demo",
    agent: "Codex",
    provider: "openai",
    model: "gpt-5.6",
    project: "nimbi",
    environment: "windows-native",
    summary: "Codex is thinking…",
  },
  working: {
    ...liveBase,
    activity: "working",
    sessionId: "codex-demo",
    agent: "Codex",
    provider: "openai",
    model: "gpt-5.6",
    project: "nimbi",
    environment: "windows-native",
    summary: "Codex is working…",
  },
  "needs-input": {
    ...liveBase,
    activity: "needs-input",
    sessionId: "claude-demo",
    agent: "Claude",
    project: "nimbi",
    environment: "windows-native",
    summary: "Claude needs your attention",
  },
  complete: {
    ...liveBase,
    activity: "complete",
    sessionId: "codex-demo",
    agent: "Codex",
    project: "nimbi",
    environment: "windows-native",
    summary: "Done",
  },
  error: {
    ...liveBase,
    activity: "error",
    sessionId: "codex-demo",
    agent: "Codex",
    project: "nimbi",
    environment: "windows-native",
    summary: "Something needs attention",
  },
};
