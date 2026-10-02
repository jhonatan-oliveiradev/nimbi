import type { NimbiSnapshot } from "../telemetry/contract";
import {
  MAX_ACTION_TEXT_LENGTH,
  type ActionComposeMode,
  type ActionRouteContext,
  type ActionUiState,
  type NimbiActionRequest,
  type NimbiActionResult,
  type RouteActionResult,
} from "./contract";

function normalizedText(text: string): string {
  return text.trim();
}

export function routeAction(
  snapshot: NimbiSnapshot,
  text: string,
  mode: ActionComposeMode,
): RouteActionResult {
  const normalized = normalizedText(text);
  if (!normalized) return { ok: false, code: "empty" };
  if (Array.from(normalized).length > MAX_ACTION_TEXT_LENGTH) {
    return { ok: false, code: "too-long" };
  }

  if (mode === "contextual" && snapshot.activity === "needs-input") {
    const sessionId = snapshot.sessionId?.trim();
    if (!sessionId) return { ok: false, code: "missing-session" };
    return {
      ok: true,
      request: { type: "reply", sessionId, text: normalized },
      context: { type: "reply", sessionId },
    };
  }

  return {
    ok: true,
    request: { type: "prompt", text: normalized },
    context: { type: "prompt" },
  };
}

interface RetrySubmission {
  request: NimbiActionRequest;
  context: ActionRouteContext;
}

export class ActionController {
  state: ActionUiState = { status: "idle" };

  private mode: ActionComposeMode = "general";
  private lastSubmission: RetrySubmission | null = null;
  private retryValid = false;

  compose(mode: ActionComposeMode): void {
    this.mode = mode;
    this.state = { status: "composing", draft: "", mode };
    this.lastSubmission = null;
    this.retryValid = false;
  }

  updateDraft(draft: string): void {
    if (this.state.status !== "composing") return;
    this.state = { ...this.state, draft };
  }

  beginSubmit(snapshot: NimbiSnapshot): RouteActionResult {
    const draft =
      this.state.status === "composing"
        ? this.state.draft
        : this.state.status === "error"
          ? this.state.draft
          : "";

    const routed = routeAction(snapshot, draft, this.mode);
    if (!routed.ok) return routed;

    this.lastSubmission = {
      request: routed.request,
      context: routed.context,
    };
    this.retryValid = true;
    this.state = { status: "sending", text: routed.request.text };
    return routed;
  }

  submitSucceeded(result: NimbiActionResult): void {
    this.retryValid = false;
    this.lastSubmission = null;
    const response = result.response?.trim();
    this.state = response
      ? { status: "response", text: response }
      : { status: "idle" };
  }

  submitFailed(message: string): void {
    const draft =
      this.lastSubmission?.request.text ??
      (this.state.status === "sending" ? this.state.text : "");
    this.state = {
      status: "error",
      message,
      draft,
    };
  }

  retryContext(): RetrySubmission | null {
    if (this.state.status !== "error" || !this.retryValid) return null;
    return this.lastSubmission
      ? {
          request: { ...this.lastSubmission.request },
          context: { ...this.lastSubmission.context },
        }
      : null;
  }

  dismissResponse(): void {
    if (this.state.status === "response") {
      this.state = { status: "idle" };
    }
  }

  reset(): void {
    this.state = { status: "idle" };
    this.lastSubmission = null;
    this.retryValid = false;
  }

  telemetryChanged(snapshot: NimbiSnapshot): void {
    if (this.lastSubmission?.context.type === "reply") {
      const currentSession =
        snapshot.activity === "needs-input" ? snapshot.sessionId?.trim() : undefined;
      if (currentSession !== this.lastSubmission.context.sessionId) {
        this.retryValid = false;
      }
    }

    if (
      this.state.status === "response" &&
      snapshot.activity !== "idle" &&
      snapshot.activity !== "offline"
    ) {
      this.state = { status: "idle" };
    }
  }
}