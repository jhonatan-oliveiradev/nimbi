export const MAX_ACTION_TEXT_LENGTH = 8_000;

export type NimbiActionRequest =
  | {
      type: "reply";
      sessionId: string;
      text: string;
    }
  | {
      type: "prompt";
      text: string;
    };

export interface NimbiActionResult {
  accepted: boolean;
  response?: string;
  sessionId?: string;
  error?: string;
}

export type ActionComposeMode = "general" | "contextual";

export type ActionRouteContext =
  | { type: "prompt" }
  | { type: "reply"; sessionId: string };

export type ActionUiState =
  | { status: "idle" }
  | { status: "composing"; draft: string; mode: ActionComposeMode }
  | { status: "sending"; text: string }
  | { status: "response"; text: string }
  | { status: "error"; message: string; draft: string };

export type RouteActionFailureCode =
  | "empty"
  | "too-long"
  | "missing-session";

export type RouteActionResult =
  | {
      ok: true;
      request: NimbiActionRequest;
      context: ActionRouteContext;
    }
  | {
      ok: false;
      code: RouteActionFailureCode;
    };
