"use client";

import dynamic from "next/dynamic";
import type { RescueMapProps } from "./RescueMapView";

const RescueMapView = dynamic(() => import("./RescueMapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-surface-2">
      <p className="text-xs text-faint">Loading rescue map…</p>
    </div>
  ),
});

export type { MapMarker, MapLine } from "./RescueMapView";

export function RescueMap(props: RescueMapProps) {
  return <RescueMapView {...props} />;
}
