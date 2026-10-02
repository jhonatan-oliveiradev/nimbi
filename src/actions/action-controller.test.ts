import { describe, expect, it } from "vitest";
import { ActionController, routeAction } from "./action-controller";
import type { NimbiSnapshot } from "../telemetry/contract";

const idle: NimbiSnapshot = {
  connected: true,
  protocol: "runoptic.telemetry.v1",
  activity: "idle",
};

const needsInput: NimbiSnapshot = {
  connected: true,
  protocol: "runoptic.telemetry.v1",
  activity: "needs-input",
  sessionId: "session-a",
  agent: "Codex",
  summary: "Apply the migration?",
};

describe("routeAction", () => {
  it("routes idle text to a prompt", () => {
    expect(routeAction(idle, "  check the build  ", "general")).toEqual({
      ok: true,
      request: { type: "prompt", text: "check the build" },
      context: { type: "prompt" },
    });
  });

  it("routes needs-input with a session to a reply", () => {
    expect(routeAction(needsInput, " yes ", "contextual")).toEqual({
      ok: true,
      request: { type: "reply", sessionId: "session-a", text: "yes" },
      context: { type: "reply", sessionId: "session-a" },
    });
  });

  it("does not fabricate a reply target when needs-input has no session", () => {
    expect(
      routeAction({ ...needsInput, sessionId: undefined }, "yes", "contextual"),
    ).toEqual({
      ok: false,
      code: "missing-session",
    });
  });

  it("allows an explicit general prompt even if needs-input lacks a session", () => {
    expect(
      routeAction({ ...needsInput, sessionId: undefined }, "help", "general"),
    ).toEqual({
      ok: true,
      request: { type: "prompt", text: "help" },
      context: { type: "prompt" },
    });
  });

  it("rejects whitespace-only text", () => {
    expect(routeAction(idle, "   ", "general")).toEqual({
      ok: false,
      code: "empty",
    });
  });

  it("rejects text above 8000 characters", () => {
    expect(routeAction(idle, "a".repeat(8001), "general")).toEqual({
      ok: false,
      code: "too-long",
    });
  });

  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(routeAction(idle, "☁️".repeat(4000), "general").ok).toBe(true);
    expect(routeAction(idle, "😀".repeat(8000), "general").ok).toBe(true);
    expect(routeAction(idle, "😀".repeat(8001), "general")).toEqual({
      ok: false,
      code: "too-long",
    });
  });
});

describe("ActionController", () => {
  it("preserves the draft when submission fails", () => {
    const controller = new ActionController();
    controller.compose("general");
    controller.updateDraft("check build");
    const routed = controller.beginSubmit(idle);
    expect(routed.ok).toBe(true);

    controller.submitFailed("NX Agent unavailable");

    expect(controller.state).toEqual({
      status: "error",
      message: "NX Agent unavailable",
      draft: "check build",
    });
  });

  it("shows a short response after successful submission", () => {
    const controller = new ActionController();
    controller.compose("general");
    controller.updateDraft("check build");
    controller.beginSubmit(idle);

    controller.submitSucceeded({
      accepted: true,
      response: "Build started. I'll keep an eye on it.",
      sessionId: "session-b",
    });

    expect(controller.state).toEqual({
      status: "response",
      text: "Build started. I'll keep an eye on it.",
    });
  });

  it("invalidates retry when the attention session changes", () => {
    const controller = new ActionController();
    controller.compose("contextual");
    controller.updateDraft("yes");
    const routed = controller.beginSubmit(needsInput);
    expect(routed.ok).toBe(true);

    controller.submitFailed("temporary failure");
    controller.telemetryChanged({
      ...needsInput,
      sessionId: "session-b",
    });

    expect(controller.retryContext()).toBeNull();
    expect(controller.state).toEqual({
      status: "error",
      message: "temporary failure",
      draft: "yes",
    });
  });

  it("retains the original reply context when the session is unchanged", () => {
    const controller = new ActionController();
    controller.compose("contextual");
    controller.updateDraft("yes");
    controller.beginSubmit(needsInput);
    controller.submitFailed("temporary failure");

    expect(controller.retryContext()).toEqual({
      request: { type: "reply", sessionId: "session-a", text: "yes" },
      context: { type: "reply", sessionId: "session-a" },
    });
  });

  it("clears an ephemeral response when meaningful RunOptic work starts", () => {
    const controller = new ActionController();
    controller.compose("general");
    controller.updateDraft("check build");
    controller.beginSubmit(idle);
    controller.submitSucceeded({ accepted: true, response: "Started." });

    controller.telemetryChanged({
      ...idle,
      activity: "working",
      sessionId: "session-b",
    });

    expect(controller.state).toEqual({ status: "idle" });
  });

  it("keeps transport error higher priority than telemetry response cleanup", () => {
    const controller = new ActionController();
    controller.compose("general");
    controller.updateDraft("check build");
    controller.beginSubmit(idle);
    controller.submitFailed("NX Agent unavailable");

    controller.telemetryChanged({
      ...idle,
      activity: "working",
      sessionId: "session-b",
    });

    expect(controller.state).toEqual({
      status: "error",
      message: "NX Agent unavailable",
      draft: "check build",
    });
  });
});