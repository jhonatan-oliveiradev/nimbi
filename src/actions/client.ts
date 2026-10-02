import { invoke } from "@tauri-apps/api/core";
import type {
  NimbiActionRequest,
  NimbiActionResult,
} from "./contract";

export type NimbiActionClientErrorCode =
  | "invalid-request"
  | "unavailable"
  | "timeout"
  | "rejected"
  | "invalid-response"
  | "unknown";

export class NimbiActionClientError extends Error {
  readonly code: NimbiActionClientErrorCode;

  constructor(code: NimbiActionClientErrorCode, message: string) {
    super(message);
    this.name = "NimbiActionClientError";
    this.code = code;
  }
}

const KNOWN_CODES = new Set<NimbiActionClientErrorCode>([
  "invalid-request",
  "unavailable",
  "timeout",
  "rejected",
  "invalid-response",
]);

function normalizeNativeError(error: unknown): NimbiActionClientError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  ) {
    const code = String((error as { code: unknown }).code);
    const message = String((error as { message: unknown }).message);
    if (KNOWN_CODES.has(code as NimbiActionClientErrorCode)) {
      return new NimbiActionClientError(
        code as NimbiActionClientErrorCode,
        message,
      );
    }
  }

  return new NimbiActionClientError(
    "unknown",
    "Nimbi could not send the action",
  );
}

export async function submitNimbiAction(
  request: NimbiActionRequest,
): Promise<NimbiActionResult> {
  try {
    return await invoke<NimbiActionResult>("submit_nimbi_action", {
      request,
    });
  } catch (error) {
    throw normalizeNativeError(error);
  }
}
