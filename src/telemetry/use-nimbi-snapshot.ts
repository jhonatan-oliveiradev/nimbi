import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { NimbiSnapshot } from "./contract";

const OFFLINE: NimbiSnapshot = {
  connected: false,
  activity: "offline",
};

export function useNimbiSnapshot(enabled = true): NimbiSnapshot {
  const [snapshot, setSnapshot] = useState<NimbiSnapshot>(OFFLINE);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(OFFLINE);
      return;
    }

    let disposed = false;
    let receivedEvent = false;
    let unlisten: UnlistenFn | undefined;

    void listen<NimbiSnapshot>("nimbi://snapshot", (event) => {
      if (disposed) return;
      receivedEvent = true;
      setSnapshot(event.payload);
    }).then((stop) => {
      if (disposed) {
        stop();
      } else {
        unlisten = stop;
      }
    }).catch(() => {
      if (!disposed && !receivedEvent) setSnapshot(OFFLINE);
    });

    void invoke<NimbiSnapshot>("get_nimbi_snapshot")
      .then((initial) => {
        if (!disposed && !receivedEvent) setSnapshot(initial);
      })
      .catch(() => {
        if (!disposed && !receivedEvent) setSnapshot(OFFLINE);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled]);

  return snapshot;
}
