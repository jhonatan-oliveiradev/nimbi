import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NIMBI_FIXTURES } from "../telemetry/fixtures";
import type { NimbiActionRequest, NimbiActionResult } from "./contract";
import { useNimbiActions } from "./use-nimbi-actions";

describe("useNimbiActions", () => {
  it("opens a general composer and submits a prompt", async () => {
    const submit = vi.fn<
      (request: NimbiActionRequest) => Promise<NimbiActionResult>
    >().mockResolvedValue({
      accepted: true,
      response: "Build started.",
      sessionId: "session-b",
    });

    const { result } = renderHook(() =>
      useNimbiActions({
        snapshot: NIMBI_FIXTURES.idle,
        submit,
      }),
    );

    act(() => {
      result.current.open("general");
      result.current.setDraft("check the build");
    });

    expect(result.current.state).toMatchObject({
      status: "composing",
      draft: "check the build",
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(submit).toHaveBeenCalledWith({
      type: "prompt",
      text: "check the build",
    });
    expect(result.current.state).toEqual({
      status: "response",
      text: "Build started.",
    });
  });

  it("submits a contextual reply for needs-input", async () => {
    const submit = vi.fn().mockResolvedValue({ accepted: true });
    const { result } = renderHook(() =>
      useNimbiActions({
        snapshot: NIMBI_FIXTURES["needs-input"],
        submit,
      }),
    );

    act(() => {
      result.current.open("contextual");
      result.current.setDraft("yes");
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(submit).toHaveBeenCalledWith({
      type: "reply",
      sessionId: "claude-demo",
      text: "yes",
    });
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("prevents duplicate submits while one request is pending", async () => {
    let resolve!: (value: NimbiActionResult) => void;
    const submit = vi.fn(
      () =>
        new Promise<NimbiActionResult>((done) => {
          resolve = done;
        }),
    );
    const { result } = renderHook(() =>
      useNimbiActions({ snapshot: NIMBI_FIXTURES.idle, submit }),
    );

    act(() => {
      result.current.open("general");
      result.current.setDraft("hello");
    });

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit();
      void result.current.submit();
    });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("sending");

    await act(async () => {
      resolve({ accepted: true });
      await first;
    });
  });

  it("preserves the draft on failure and retries the same request", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce({
        code: "unavailable",
        message: "NX Agent is unavailable",
      })
      .mockResolvedValueOnce({ accepted: true });

    const { result } = renderHook(() =>
      useNimbiActions({ snapshot: NIMBI_FIXTURES.idle, submit }),
    );

    act(() => {
      result.current.open("general");
      result.current.setDraft("check build");
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toEqual({
      status: "error",
      message: "NX Agent is unavailable",
      draft: "check build",
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith({
      type: "prompt",
      text: "check build",
    });
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("does not retry a reply after the attention session changes", async () => {
    const submit = vi.fn().mockRejectedValue({
      code: "unavailable",
      message: "temporary failure",
    });
    const { result, rerender } = renderHook(
      ({ snapshot }) => useNimbiActions({ snapshot, submit }),
      {
        initialProps: { snapshot: NIMBI_FIXTURES["needs-input"] },
      },
    );

    act(() => {
      result.current.open("contextual");
      result.current.setDraft("yes");
    });
    await act(async () => {
      await result.current.submit();
    });

    rerender({
      snapshot: {
        ...NIMBI_FIXTURES["needs-input"],
        sessionId: "different-session",
      },
    });

    await waitFor(() => expect(result.current.canRetry).toBe(false));
    await act(async () => {
      await result.current.retry();
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("lets a general prompt work while RunOptic is offline", async () => {
    const submit = vi.fn().mockResolvedValue({ accepted: true });
    const { result } = renderHook(() =>
      useNimbiActions({ snapshot: NIMBI_FIXTURES.offline, submit }),
    );

    act(() => {
      result.current.open("general");
      result.current.setDraft("hello");
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(submit).toHaveBeenCalledWith({ type: "prompt", text: "hello" });
  });

  it("clears an ephemeral response when real work arrives", async () => {
    const submit = vi.fn().mockResolvedValue({
      accepted: true,
      response: "Starting.",
    });
    const { result, rerender } = renderHook(
      ({ snapshot }) => useNimbiActions({ snapshot, submit }),
      { initialProps: { snapshot: NIMBI_FIXTURES.idle } },
    );

    act(() => {
      result.current.open("general");
      result.current.setDraft("work");
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.status).toBe("response");

    rerender({ snapshot: NIMBI_FIXTURES.working });
    await waitFor(() => expect(result.current.state.status).toBe("idle"));
  });
});
