import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NimbiActionRequest } from "./contract";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import {
  NimbiActionClientError,
  submitNimbiAction,
} from "./client";

describe("submitNimbiAction", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("uses exactly one Tauri command and preserves the request payload", async () => {
    const request: NimbiActionRequest = {
      type: "reply",
      sessionId: "session-a",
      text: "yes",
    };
    invokeMock.mockResolvedValue({
      accepted: true,
      response: "Continuing.",
      sessionId: "session-a",
    });

    await expect(submitNimbiAction(request)).resolves.toEqual({
      accepted: true,
      response: "Continuing.",
      sessionId: "session-a",
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("submit_nimbi_action", {
      request,
    });
  });

  it("maps a typed native error to NimbiActionClientError", async () => {
    invokeMock.mockRejectedValue({
      code: "unavailable",
      message: "NX Agent is unavailable",
    });

    const promise = submitNimbiAction({
      type: "prompt",
      text: "check build",
    });

    await expect(promise).rejects.toMatchObject({
      name: "NimbiActionClientError",
      code: "unavailable",
      message: "NX Agent is unavailable",
    });
    await expect(promise).rejects.toBeInstanceOf(NimbiActionClientError);
  });

  it("normalizes unknown native failures without exposing raw objects", async () => {
    invokeMock.mockRejectedValue(new Error("IPC exploded"));

    await expect(
      submitNimbiAction({ type: "prompt", text: "hello" }),
    ).rejects.toMatchObject({
      name: "NimbiActionClientError",
      code: "unknown",
      message: "Nimbi could not send the action",
    });
  });

  it("never calls fetch directly", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch must not be used"));
    invokeMock.mockResolvedValue({ accepted: true });

    await submitNimbiAction({ type: "prompt", text: "hello" });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
