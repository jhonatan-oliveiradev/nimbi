import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLACEMENT, DEFAULT_PRESENCE } from "./placement";

const invokeMock = vi.fn();
const listenMock = vi.fn();
const unlistenPrefs = vi.fn();
const unlistenLayout = vi.fn();
let preferenceHandler: ((event: { payload: unknown }) => void) | undefined;
let layoutHandler: ((event: { payload: unknown }) => void) | undefined;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

import { useNimbiPreferences } from "./use-nimbi-preferences";

describe("useNimbiPreferences", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    unlistenPrefs.mockReset();
    unlistenLayout.mockReset();
    preferenceHandler = undefined;
    layoutHandler = undefined;

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "get_preferences") {
        return {
          placement: { mode: "docked", edge: "right", offset: 0.4 },
          presence: { idleOpacity: 0.55 },
        };
      }
      if (command === "get_shell_layout") {
        return {
          anchorX: 150,
          anchorY: 320,
          orientation: "vertical",
          viewportWidth: 1280,
          viewportHeight: 720,
          monitorId: "DISPLAY1",
        };
      }
      return undefined;
    });

    listenMock.mockImplementation(
      async (eventName: string, handler: (event: { payload: unknown }) => void) => {
        if (eventName === "nimbi://preferences") {
          preferenceHandler = handler;
          return unlistenPrefs;
        }
        layoutHandler = handler;
        return unlistenLayout;
      },
    );
  });

  it("loads persisted native preferences and shell layout", async () => {
    const { result } = renderHook(() => useNimbiPreferences(true));

    await waitFor(() =>
      expect(result.current.preferences.placement).toEqual({
        mode: "docked",
        edge: "right",
        offset: 0.4,
      }),
    );
    expect(result.current.preferences.presence.idleOpacity).toBe(0.55);
    expect(result.current.layout?.orientation).toBe("vertical");
  });

  it("updates when Rust emits preference and layout changes", async () => {
    const { result } = renderHook(() => useNimbiPreferences(true));
    await waitFor(() => expect(preferenceHandler).toBeTypeOf("function"));

    act(() => {
      preferenceHandler?.({
        payload: {
          placement: { mode: "floating", x: 0.7, y: 0.2 },
          presence: { idleOpacity: 0.4 },
        },
      });
      layoutHandler?.({
        payload: {
          anchorX: 210,
          anchorY: 80,
          orientation: "horizontal",
          viewportWidth: 1440,
          viewportHeight: 900,
          monitorId: "DISPLAY2",
        },
      });
    });

    expect(result.current.preferences.placement).toEqual({
      mode: "floating",
      x: 0.7,
      y: 0.2,
    });
    expect(result.current.layout?.monitorId).toBe("DISPLAY2");
  });

  it("stays on safe defaults outside Tauri", () => {
    const { result } = renderHook(() => useNimbiPreferences(false));

    expect(result.current.preferences).toEqual({
      placement: DEFAULT_PLACEMENT,
      presence: DEFAULT_PRESENCE,
    });
    expect(result.current.layout).toBeUndefined();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
