"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAppStore } from "./useAppStore";

export function useHydratedStore(): boolean {
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return hydrated;
}

export function useNow(intervalMs = 10_000): number {
  const clockOffsetMs = useAppStore((state) => state.clockOffsetMs);
  const tick = useAppStore((state) => state.tick);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(() => {
        tick();
        onChange();
      }, intervalMs);
      return () => window.clearInterval(id);
    },
    [intervalMs, tick],
  );

  const getSnapshot = useCallback(
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    [intervalMs],
  );

  const bucket = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  return bucket + clockOffsetMs;
}
