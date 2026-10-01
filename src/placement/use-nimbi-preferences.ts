import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import {
  DEFAULT_PLACEMENT,
  DEFAULT_PRESENCE,
  normalizePlacement,
  normalizePresence,
  type NimbiOrientation,
  type NimbiPlacement,
  type NimbiPresence,
} from "./placement";

export interface NimbiPreferences {
  placement: NimbiPlacement;
  presence: NimbiPresence;
}

export interface NimbiShellLayout {
  anchorX: number;
  anchorY: number;
  orientation: NimbiOrientation;
  viewportWidth: number;
  viewportHeight: number;
  monitorId: string;
}

const DEFAULT_PREFERENCES: NimbiPreferences = {
  placement: DEFAULT_PLACEMENT,
  presence: DEFAULT_PRESENCE,
};

function normalizePreferences(value: NimbiPreferences): NimbiPreferences {
  return {
    placement: normalizePlacement(value.placement),
    presence: normalizePresence(value.presence),
  };
}

export function useNimbiPreferences(enabled: boolean): {
  preferences: NimbiPreferences;
  layout: NimbiShellLayout | undefined;
} {
  const [preferences, setPreferences] =
    useState<NimbiPreferences>(DEFAULT_PREFERENCES);
  const [layout, setLayout] = useState<NimbiShellLayout>();

  useEffect(() => {
    if (!enabled) {
      setPreferences(DEFAULT_PREFERENCES);
      setLayout(undefined);
      return;
    }

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void invoke<NimbiPreferences>("get_preferences")
      .then((value) => {
        if (!disposed) setPreferences(normalizePreferences(value));
      })
      .catch(() => {});

    void invoke<NimbiShellLayout | null>("get_shell_layout")
      .then((value) => {
        if (!disposed && value) setLayout(value);
      })
      .catch(() => {});

    void listen<NimbiPreferences>("nimbi://preferences", (event) => {
      if (!disposed) setPreferences(normalizePreferences(event.payload));
    }).then((stop) => {
      if (disposed) stop();
      else unlisteners.push(stop);
    }).catch(() => {});

    void listen<NimbiShellLayout>("nimbi://shell-layout", (event) => {
      if (!disposed) setLayout(event.payload);
    }).then((stop) => {
      if (disposed) stop();
      else unlisteners.push(stop);
    }).catch(() => {});

    return () => {
      disposed = true;
      for (const stop of unlisteners) stop();
    };
  }, [enabled]);

  return { preferences, layout };
}
