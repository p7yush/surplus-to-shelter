import type { AppData } from "@/lib/domain/types";
import type { ConnectionStatus, DataAdapter, RemoteEvent } from "./adapter";

const STORAGE_KEY = "surplus-to-shelter:state:v1";
const CHANNEL_NAME = "surplus-to-shelter:sync";

export function createLocalAdapter(): DataAdapter {
  let channel: BroadcastChannel | null = null;
  let muted = false;

  return {
    kind: "local",

    load: async () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as AppData) : null;
      } catch {
        return null;
      }
    },

    persist: (next) => {
      if (typeof window === "undefined" || muted) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        channel?.postMessage(next);
      } catch {
        /* storage unavailable, keep running in memory */
      }
    },

    reset: async (data) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        channel?.postMessage(data);
      } catch {
        /* storage unavailable */
      }
    },

    subscribe: (onEvent: (event: RemoteEvent) => void, onStatus: (status: ConnectionStatus) => void) => {
      if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
        onStatus("local");
        return () => {};
      }

      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<AppData>) => {
        muted = true;
        onEvent({ type: "snapshot", data: event.data });
        muted = false;
      };
      onStatus("local");

      return () => {
        channel?.close();
        channel = null;
      };
    },
  };
}
