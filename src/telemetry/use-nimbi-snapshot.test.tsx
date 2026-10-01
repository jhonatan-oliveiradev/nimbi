import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NIMBI_FIXTURES } from "./fixtures";

const invokeMock = vi.fn();
const listenMock = vi.fn();
const unlistenMock = vi.fn();
let snapshotHandler:
  | ((event: { payload: typeof NIMBI_FIXTURES.working }) => void)
  | undefined;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

import { useNimbiSnapshot } from "./use-nimbi-snapshot";

describe("useNimbiSnapshot", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    unlistenMock.mockReset();
    snapshotHandler = undefined;

    invokeMock.mockResolvedValue(NIMBI_FIXTURES.idle);
    listenMock.mockImplementation(
      async (_eventName: string, handler: typeof snapshotHandler) => {
        snapshotHandler = handler;
        return unlistenMock;
      },
    );
  });

  it("loads the initial Rust snapshot", async () => {
    const { result } = renderHook(() => useNimbiSnapshot(true));

    await waitFor(() => expect(result.current.activity).toBe("idle"));
    expect(invokeMock).toHaveBeenCalledWith("get_nimbi_snapshot");
  });

  it("replaces state when Rust emits nimbi://snapshot", async () => {
    const { result } = renderHook(() => useNimbiSnapshot(true));
    await waitFor(() => expect(snapshotHandler).toBeTypeOf("function"));

    act(() => {
      snapshotHandler?.({ payload: NIMBI_FIXTURES.working });
    });

    expect(result.current.activity).toBe("working");
    expect(result.current.agent).toBe("Codex");
  });

  it("offline events clear stale attribution", async () => {
    const { result } = renderHook(() => useNimbiSnapshot(true));
    await waitFor(() => expect(snapshotHandler).toBeTypeOf("function"));

    act(() => snapshotHandler?.({ payload: NIMBI_FIXTURES.working }));
    expect(result.current.model).toBe("gpt-5.6");

    act(() =>
      snapshotHandler?.({
        payload: NIMBI_FIXTURES.offline as typeof NIMBI_FIXTURES.working,
      }),
    );

    expect(result.current.activity).toBe("offline");
    expect(result.current.agent).toBeUndefined();
    expect(result.current.provider).toBeUndefined();
    expect(result.current.model).toBeUndefined();
    expect(result.current.project).toBeUndefined();
  });

  it("surfaces a real working to complete transition", async () => {
    const { result } = renderHook(() => useNimbiSnapshot(true));
    await waitFor(() => expect(snapshotHandler).toBeTypeOf("function"));

    act(() => snapshotHandler?.({ payload: NIMBI_FIXTURES.working }));
    expect(result.current.activity).toBe("working");

    act(() =>
      snapshotHandler?.({
        payload: NIMBI_FIXTURES.complete as typeof NIMBI_FIXTURES.working,
      }),
    );
    expect(result.current.activity).toBe("complete");
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useNimbiSnapshot(true));
    await waitFor(() => expect(snapshotHandler).toBeTypeOf("function"));

    unmount();

    await waitFor(() => expect(unlistenMock).toHaveBeenCalledTimes(1));
  });

  it("does not touch Tauri when disabled for browser fixtures", async () => {
    const { result } = renderHook(() => useNimbiSnapshot(false));

    expect(result.current.activity).toBe("offline");
    expect(invokeMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
  });
});
