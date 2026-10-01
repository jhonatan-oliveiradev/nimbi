import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLACEMENT } from "../placement/placement";

const invokeMock = vi.fn();
const listenMock = vi.fn();
const unlistenMock = vi.fn();
let preferenceHandler:
  | ((event: { payload: { version: 1; placement: typeof DEFAULT_PLACEMENT; presence: { passiveOpacity: number } } }) => void)
  | undefined;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

import { useNimbiPreferences } from "./use-nimbi-preferences";

const initial = {
  version: 1 as const,
  placement: DEFAULT_PLACEMENT,
  presence: { passiveOpacity: 0.72 },
};

describe("useNimbiPreferences", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    unlistenMock.mockReset();
    preferenceHandler = undefined;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "get_preferences") return initial;
      if (command === "save_presence") {
        return {
          ...initial,
          presence: { passiveOpacity: 0.44 },
        };
      }
      if (command === "reset_placement") return initial;
      return undefined;
    });
    listenMock.mockImplementation(
      async (_event: string, handler: typeof preferenceHandler) => {
        preferenceHandler = handler;
        return unlistenMock;
      },
    );
  });

  it("loads persisted placement and presence from Rust", async () => {
    const { result } = renderHook(() => useNimbiPreferences(true));
    await waitFor(() => expect(result.current.preferences.version).toBe(1));
    expect(result.current.preferences.placement).toEqual(DEFAULT_PLACEMENT);
    expect(result.current.preferences.presence.passiveOpacity).toBe(0.72);
  });

  it("accepts preference updates emitted by Rust", async () => {
    const { result } = renderHook(() => useNimbiPreferences(true));
    await waitFor(() => expect(preferenceHandler).toBeTypeOf("function"));

    act(() => {
      preferenceHandler?.({
        payload: {
          version: 1,
          placement: {
            mode: "docked",
            monitorId: "secondary",
            edge: "right",
            offset: 0.25,
          },
          presence: { passiveOpacity: 0.5 },
        },
      });
    });

    expect(result.current.preferences.presence.passiveOpacity).toBe(0.5);
    expect(result.current.preferences.placement).toMatchObject({
      edge: "right",
      monitorId: "secondary",
    });
  });

  it("saves passive opacity through Rust", async () => {
    const { result } = renderHook(() => useNimbiPreferences(true));
    await act(async () => {
      await result.current.savePassiveOpacity(0.44);
    });

    expect(invokeMock).toHaveBeenCalledWith("save_presence", {
      presence: { passiveOpacity: 0.44 },
    });
  });

  it("resets placement through Rust", async () => {
    const { result } = renderHook(() => useNimbiPreferences(true));
    await act(async () => {
      await result.current.resetPlacement();
    });

    expect(invokeMock).toHaveBeenCalledWith("reset_placement");
  });

  it("stays local-only when disabled", async () => {
    const { result } = renderHook(() => useNimbiPreferences(false));
    expect(result.current.preferences).toEqual(initial);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
  });
});
