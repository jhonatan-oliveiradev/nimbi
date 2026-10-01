import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PLACEMENT,
  type NimbiPlacement,
} from "../placement/placement";

export interface NimbiPreferences {
  version: 1;
  placement: NimbiPlacement;
  presence: {
    passiveOpacity: number;
  };
}

export const DEFAULT_PREFERENCES: NimbiPreferences = {
  version: 1,
  placement: DEFAULT_PLACEMENT,
  presence: {
    passiveOpacity: 0.72,
  },
};

function normalizePreferences(value: NimbiPreferences): NimbiPreferences {
  return {
    version: 1,
    placement: value.placement ?? DEFAULT_PLACEMENT,
    presence: {
      passiveOpacity: Math.min(
        1,
        Math.max(0.2, Number.isFinite(value.presence?.passiveOpacity) ? value.presence.passiveOpacity : 0.72),
      ),
    },
  };
}

export function useNimbiPreferences(enabled: boolean) {
  const [preferences, setPreferences] =
    useState<NimbiPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void invoke<NimbiPreferences>("get_preferences")
      .then((next) => {
        if (!disposed) setPreferences(normalizePreferences(next));
      })
      .catch(() => {});

    void listen<NimbiPreferences>("nimbi://preferences", (event) => {
      if (!disposed) setPreferences(normalizePreferences(event.payload));
    })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled]);

  const savePassiveOpacity = useCallback(
    async (passiveOpacity: number) => {
      const clamped = Math.min(1, Math.max(0.2, passiveOpacity));
      if (!enabled) {
        setPreferences((current) => ({
          ...current,
          presence: { passiveOpacity: clamped },
        }));
        return;
      }

      const next = await invoke<NimbiPreferences>("save_presence", {
        presence: { passiveOpacity: clamped },
      });
      setPreferences(normalizePreferences(next));
    },
    [enabled],
  );

  const resetPlacement = useCallback(async () => {
    if (!enabled) {
      setPreferences((current) => ({
        ...current,
        placement: DEFAULT_PLACEMENT,
      }));
      return;
    }

    const next = await invoke<NimbiPreferences>("reset_placement");
    setPreferences(normalizePreferences(next));
  }, [enabled]);

  return {
    preferences,
    savePassiveOpacity,
    resetPlacement,
  };
}
